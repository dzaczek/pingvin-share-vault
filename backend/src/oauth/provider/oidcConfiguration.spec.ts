import { ErrorPageException } from "../exceptions/errorPage.exception";
import { OidcProvider } from "./oidc.provider";

// What an admin types into the OIDC settings is often a little off: the
// issuer instead of the discovery url, a trailing slash, a wrong host. Sign in
// should then end on a clear error page, not a 500 or a broken redirect.

const build = (settings: Record<string, string>) => {
  const config = {
    get: (key: string) => settings[key] ?? "",
    addListener: jest.fn(),
  } as any;
  const cache = { set: jest.fn() } as any;
  return new OidcProvider(config, {} as any, cache);
};

const discoveryOf = (provider: OidcProvider) => (provider as any).discoveryUri;

const respond = (status: number, body: unknown) =>
  jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );

afterEach(() => jest.restoreAllMocks());

describe("OIDC discovery uri", () => {
  it.each([
    ["https://auth.example.com", "https://auth.example.com/.well-known/openid-configuration"],
    ["https://auth.example.com/", "https://auth.example.com/.well-known/openid-configuration"],
    ["https://kc.example.com/realms/main", "https://kc.example.com/realms/main/.well-known/openid-configuration"],
    ["https://auth.example.com/.well-known/openid-configuration", "https://auth.example.com/.well-known/openid-configuration"],
    ["https://auth.example.com/.well-known/app/openid-configuration", "https://auth.example.com/.well-known/app/openid-configuration"],
    ["https://auth.example.com/.well-known", "https://auth.example.com/.well-known/openid-configuration"],
    ["https://auth.example.com/.well-known/oauth-authorization-server", "https://auth.example.com/.well-known/oauth-authorization-server"],
  ])("turns %s into %s", (given, expected) => {
    expect(discoveryOf(build({ "oauth.oidc-discoveryUri": given }))).toBe(expected);
  });
});

describe("OIDC sign in with a broken setup", () => {
  const settings = {
    "oauth.oidc-discoveryUri": "https://auth.example.com",
    "oauth.oidc-clientId": "client",
  };

  it("shows the error page when discovery answers with an error", async () => {
    respond(404, { error: "not found" });
    await expect(build(settings).getAuthEndpoint("state")).rejects.toEqual(
      new ErrorPageException("oidc_configuration_error"),
    );
  });

  it("shows the error page when discovery has no endpoints", async () => {
    respond(200, { issuer: "https://auth.example.com" });
    await expect(build(settings).getAuthEndpoint("state")).rejects.toEqual(
      new ErrorPageException("oidc_configuration_error"),
    );
  });

  it("shows the error page when no client id is set", async () => {
    respond(200, {
      authorization_endpoint: "https://auth.example.com/authorize",
      token_endpoint: "https://auth.example.com/token",
    });
    await expect(
      build({ ...settings, "oauth.oidc-clientId": "" }).getAuthEndpoint("state"),
    ).rejects.toEqual(new ErrorPageException("oidc_configuration_error"));
  });

  it("builds the redirect when everything is in place", async () => {
    respond(200, {
      authorization_endpoint: "https://auth.example.com/authorize",
      token_endpoint: "https://auth.example.com/token",
    });
    const url = await build(settings).getAuthEndpoint("state");
    expect(url).toMatch(/^https:\/\/auth\.example\.com\/authorize\?client_id=client&/);
  });
});
