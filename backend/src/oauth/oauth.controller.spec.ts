import { OAuthController } from "./oauth.controller";

// The redirect URI follows the host the sign in started on, but only for
// hosts in oauth.allowedHosts. Any other Host header falls back to
// general.appUrl, so a forged header cannot pick where the code is sent.

const buildController = (allowedHosts = "") => {
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          "general.appUrl": "https://share.example.com",
          "oauth.allowedHosts": allowedHosts,
          "security.secureCookies": true,
        })[key],
    ),
  };
  const provider = {
    getAuthEndpoint: jest.fn().mockResolvedValue("https://idp.example/auth"),
    getToken: jest.fn().mockResolvedValue({ idToken: "t" }),
    getUserInfo: jest.fn().mockResolvedValue({ providerId: "p" }),
  };
  const authService = {
    getIdOfCurrentUser: jest.fn().mockResolvedValue(null),
    addTokensToResponse: jest.fn(),
  };
  const oauthService = {
    signIn: jest
      .fn()
      .mockResolvedValue({ accessToken: "a", refreshToken: "r" }),
    link: jest.fn(),
  };
  const controller = new OAuthController(
    authService as any,
    oauthService as any,
    config as any,
    { oidc: provider },
  );
  return { controller, provider, oauthService };
};

const request = (host: string | undefined, protocol = "https") =>
  ({ get: () => host, protocol, ip: "127.0.0.1" }) as any;

const response = () => ({ cookie: jest.fn(), redirect: jest.fn() }) as any;

const redirectUriFor = async (
  host: string | undefined,
  allowedHosts?: string,
  protocol?: string,
) => {
  const { controller, provider } = buildController(allowedHosts);
  await controller.auth("oidc", request(host, protocol), response());
  return provider.getAuthEndpoint.mock.calls[0][1];
};

describe("OAuthController redirect URI", () => {
  it("uses the app URL for the primary host", async () => {
    expect(await redirectUriFor("share.example.com")).toBe(
      "https://share.example.com/api/oauth/callback/oidc",
    );
  });

  it("keeps an allowed alternative host", async () => {
    expect(
      await redirectUriFor(
        "Share.Internal.example.com",
        "other.example, share.internal.example.com",
      ),
    ).toBe("https://share.internal.example.com/api/oauth/callback/oidc");
  });

  it("ignores a host that is not on the list", async () => {
    expect(
      await redirectUriFor("evil.example", "share.internal.example.com"),
    ).toBe("https://share.example.com/api/oauth/callback/oidc");
    expect(await redirectUriFor(undefined)).toBe(
      "https://share.example.com/api/oauth/callback/oidc",
    );
  });

  it("sends the same redirect URI to the token endpoint", async () => {
    const { controller, provider } = buildController(
      "share.internal.example.com",
    );
    await controller.callback(
      "oidc",
      { code: "c", state: "s" } as any,
      request("share.internal.example.com"),
      response(),
    );
    expect(provider.getToken.mock.calls[0][1]).toBe(
      "https://share.internal.example.com/api/oauth/callback/oidc",
    );
  });

  it("redirects relative and clears the state cookie after the callback", async () => {
    const { controller } = buildController();
    const res = response();
    await controller.callback(
      "oidc",
      { code: "c", state: "s" } as any,
      request("share.example.com"),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith("/");
    expect(res.cookie).toHaveBeenCalledWith(
      "oauth_oidc_state",
      "",
      expect.objectContaining({ maxAge: -1 }),
    );
  });
});
