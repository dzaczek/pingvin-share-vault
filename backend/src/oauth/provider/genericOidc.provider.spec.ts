import { JwtService } from "@nestjs/jwt";
import { Cache } from "cache-manager";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  exportJWK,
  generateKeyPair,
  JWK,
  KeyLike,
  SignJWT,
} from "jose";
import { ConfigService } from "../../config/config.service";
import { OAuthCallbackDto } from "../dto/oauthCallback.dto";
import {
  GenericOidcProvider,
  OidcConfiguration,
  OidcIdToken,
} from "./genericOidc.provider";
import { MicrosoftProvider } from "./microsoft.provider";

// the provider's key set is served from memory instead of over the network
jest.mock("jose", () => {
  const actual = jest.requireActual("jose");
  return { ...actual, createRemoteJWKSet: jest.fn() };
});

// Minimal concrete provider so the abstract base can be driven directly.
class TestProvider extends GenericOidcProvider {
  constructor(
    config: ConfigService,
    jwt: JwtService,
    cache: Cache,
    name = "test",
  ) {
    super(name, [], config, jwt, cache);
  }
  protected getDiscoveryUri(): string {
    return "https://example.invalid/.well-known/openid-configuration";
  }
}

const NONCE = "nonce-value";
const ISSUER = "https://idp.example";
const CLIENT_ID = "client-1";
const CLIENT_SECRET = "a-client-secret-of-at-least-32-bytes!";

let privateKey: KeyLike;
let otherKey: KeyLike;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  otherKey = (await generateKeyPair("RS256")).privateKey;
});

beforeEach(() => {
  (createRemoteJWKSet as jest.Mock).mockReturnValue(
    createLocalJWKSet({ keys: [jwk] }),
  );
});

type Claims = Partial<OidcIdToken> & Record<string, unknown>;

const sign = (
  claims: Claims,
  { key, alg = "RS256" }: { key?: KeyLike | Uint8Array; alg?: string } = {},
) =>
  new SignJWT({
    iss: ISSUER,
    aud: CLIENT_ID,
    sub: "subject-1",
    nonce: NONCE,
    name: "Test User",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    ...claims,
  } as any)
    .setProtectedHeader({ alg, kid: "k1" })
    .sign(key ?? privateKey);

const configuration = (extra: Partial<OidcConfiguration> = {}) =>
  ({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/auth`,
    token_endpoint: `${ISSUER}/token`,
    jwks_uri: `${ISSUER}/jwks`,
    response_types_supported: ["code"],
    id_token_signing_alg_values_supported: ["RS256"],
    ...extra,
  }) as OidcConfiguration;

const buildProvider = (
  name?: string,
  {
    cachedNonce = NONCE,
    discovery = configuration(),
  }: { cachedNonce?: string; discovery?: OidcConfiguration } = {},
) => {
  const config = {
    get: jest.fn((key: string) =>
      key.endsWith("-clientId")
        ? CLIENT_ID
        : key.endsWith("-clientSecret")
          ? CLIENT_SECRET
          : "",
    ),
    addListener: jest.fn(),
  } as unknown as ConfigService;

  const cache = {
    get: jest.fn().mockResolvedValue(cachedNonce),
    del: jest.fn().mockResolvedValue(undefined),
  } as unknown as Cache;

  const provider =
    name === "microsoft"
      ? new MicrosoftProvider(config, {} as JwtService, cache)
      : new TestProvider(config, {} as JwtService, cache, name);
  jest.spyOn(provider, "getConfiguration").mockResolvedValue(discovery);
  return provider;
};

const signInWith = (provider: GenericOidcProvider, idToken: string) =>
  provider.getUserInfo(
    { idToken, accessToken: "a", tokenType: "Bearer" } as any,
    { state: "state-1" } as OAuthCallbackDto,
  );

const signIn = async (claims: Claims, name?: string) =>
  signInWith(buildProvider(name), await sign(claims));

describe("GenericOidcProvider email verification", () => {
  it("accepts an explicitly verified address", async () => {
    const user = await signIn({
      email: "user@example.com",
      email_verified: true,
    });
    expect(user.email).toBe("user@example.com");
  });

  // Microsoft and Entra ID never send email_verified. Requiring it locked
  // every Microsoft user out, so a missing claim must stay acceptable.
  it("accepts a missing email_verified claim", async () => {
    const user = await signIn({ email: "user@example.com" });
    expect(user.email).toBe("user@example.com");
  });

  it("rejects an address the provider says is unverified", async () => {
    await expect(
      signIn({ email: "user@example.com", email_verified: false }),
    ).rejects.toMatchObject({ key: "email_not_verified" });
  });

  it("does not care about the claim when no email is sent at all", async () => {
    const user = await signIn({ email: undefined });
    expect(user.providerId).toBe("subject-1");
  });

  // A missing claim still lets the user in, but only an address the provider
  // vouches for counts as confirmed for share recipients
  it("vouches for an address only when the provider says it is verified", async () => {
    expect((await signIn({ email: "a@example.com" })).emailVerified).toBe(
      false,
    );
    expect(
      (await signIn({ email: "a@example.com", email_verified: true }))
        .emailVerified,
    ).toBe(true);
  });

  it("vouches for Microsoft addresses, which come from the tenant directory", async () => {
    const provider = buildProvider("microsoft", {
      discovery: configuration({
        issuer: "https://login.microsoftonline.com/{tenantid}/v2.0",
      }),
    });
    const user = await signInWith(
      provider,
      await sign({
        iss: "https://login.microsoftonline.com/t-1/v2.0",
        tid: "t-1",
        email: "a@example.com",
      }),
    );
    expect(user.emailVerified).toBe(true);
  });
});

// The ID token used to be decoded without any check, so whatever came back
// from the token endpoint was believed: another client's token, an expired
// one, or one signed by nobody.
describe("GenericOidcProvider ID token validation", () => {
  const rejects = (promise: Promise<unknown>) =>
    expect(promise).rejects.toMatchObject({ key: "invalid_token" });

  it("rejects a token not signed by the provider", async () => {
    await rejects(
      signInWith(buildProvider(), await sign({}, { key: otherKey })),
    );
  });

  it("rejects a token issued for another client", async () => {
    await rejects(signIn({ aud: "someone-else" }));
  });

  it("rejects a token from another issuer", async () => {
    await rejects(signIn({ iss: "https://evil.example" }));
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    await rejects(signIn({ iat: now - 3600, exp: now - 600 }));
  });

  it("rejects a token presented by another party", async () => {
    await rejects(signIn({ azp: "someone-else" }));
  });

  it("rejects a token without a subject", async () => {
    await rejects(signIn({ sub: undefined }));
  });

  it("rejects a sign in whose nonce is no longer cached", async () => {
    await rejects(
      signInWith(
        buildProvider(undefined, { cachedNonce: undefined }),
        await sign({ nonce: undefined }),
      ),
    );
  });

  it("rejects a token signed with an algorithm the provider does not use", async () => {
    const secret = new TextEncoder().encode(CLIENT_SECRET);
    await rejects(
      signInWith(
        buildProvider(),
        await sign({}, { key: secret, alg: "HS256" }),
      ),
    );
  });

  it("accepts a token signed with the client secret when the provider uses HS256", async () => {
    const secret = new TextEncoder().encode(CLIENT_SECRET);
    const provider = buildProvider(undefined, {
      discovery: configuration({
        id_token_signing_alg_values_supported: ["HS256"],
      }),
    });
    const user = await signInWith(
      provider,
      await sign({}, { key: secret, alg: "HS256" }),
    );
    expect(user.providerId).toBe("subject-1");
  });

  it("rejects a Microsoft token for a tenant other than the one it names", async () => {
    const provider = buildProvider("microsoft", {
      discovery: configuration({
        issuer: "https://login.microsoftonline.com/{tenantid}/v2.0",
      }),
    });
    await rejects(
      signInWith(
        provider,
        await sign({
          iss: "https://login.microsoftonline.com/t-1/v2.0",
          tid: "t-2",
        }),
      ),
    );
  });
});
