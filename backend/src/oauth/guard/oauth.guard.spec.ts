import { OAuthGuard } from "./oauth.guard";

// The callback compared the state parameter with the state cookie. With
// neither there, undefined === undefined let the callback through, which is
// the CSRF check on the OAuth sign in doing nothing.

const run = (state: unknown, cookie: unknown) =>
  new OAuthGuard().canActivate({
    switchToHttp: () => ({
      getRequest: () => ({
        params: { provider: "oidc" },
        query: state === undefined ? {} : { state },
        cookies: cookie === undefined ? {} : { oauth_oidc_state: cookie },
      }),
    }),
  } as any);

describe("OAuthGuard", () => {
  it("lets a callback through whose state matches the cookie", () => {
    expect(run("abc123", "abc123")).toBe(true);
  });

  it("refuses a state that does not match", () => {
    expect(run("abc123", "other")).toBe(false);
  });

  it("refuses a callback without state or without the cookie", () => {
    expect(run(undefined, undefined)).toBe(false);
    expect(run("", "")).toBe(false);
    expect(run("abc123", undefined)).toBe(false);
    expect(run(undefined, "abc123")).toBe(false);
  });

  it("refuses a repeated state parameter", () => {
    expect(run(["abc123", "abc123"], "abc123")).toBe(false);
  });
});
