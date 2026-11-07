import { getOAuthUrl } from "./oauth.util";

// The OAuth flow has to run on the host the provider sends the user back to,
// because the state cookie lives there. Only hosts in oauth.allowedHosts keep
// their own host, and only for providers that accept more than one callback.

const config =
  (values: Record<string, string>) => (key: string, returnDefault?: boolean) =>
    returnDefault && key === "general.appUrl"
      ? "http://localhost:3000"
      : values[key];

const internal = {
  host: "share.internal.example.com",
  origin: "https://share.internal.example.com",
};

describe("getOAuthUrl", () => {
  const get = config({
    "general.appUrl": "https://share.example.com",
    "oauth.allowedHosts": "other.example, Share.Internal.example.com",
  });

  it("stays on an allowed alternative host", () => {
    expect(getOAuthUrl("oidc", get, internal)).toBe("/api/oauth/auth/oidc");
    expect(getOAuthUrl("google", get, internal)).toBe("/api/oauth/auth/google");
  });

  it("sends GitHub and Discord to the app URL", () => {
    expect(getOAuthUrl("github", get, internal)).toBe(
      "https://share.example.com/api/oauth/auth/github",
    );
  });

  it("uses the app URL on a host that is not listed", () => {
    expect(
      getOAuthUrl("oidc", get, {
        host: "192.168.1.10:3000",
        origin: "http://192.168.1.10:3000",
      }),
    ).toBe("https://share.example.com/api/oauth/auth/oidc");
  });

  it("uses the current origin while the app URL is the default", () => {
    const unset = config({
      "general.appUrl": "http://localhost:3000",
      "oauth.allowedHosts": "",
    });
    expect(getOAuthUrl("oidc", unset, internal)).toBe(
      "https://share.internal.example.com/api/oauth/auth/oidc",
    );
  });
});
