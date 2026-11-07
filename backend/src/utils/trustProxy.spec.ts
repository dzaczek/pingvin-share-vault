import * as proxyaddr from "proxy-addr";
import { trustProxySetting } from "./trustProxy.util";

// req.ip is what Express's proxy-addr picks with the "trust proxy" value, so
// the tests resolve real requests with it. Behind the bundled Caddy, trusting
// nothing made every visitor 127.0.0.1 (one rate limit bucket for everyone),
// and TRUST_PROXY=true trusted every hop, so X-Forwarded-For chose req.ip.

const clientOf = (
  env: Parameters<typeof trustProxySetting>[0],
  remoteAddress: string,
  forwardedFor?: string,
) => {
  const setting = trustProxySetting(env);
  const trust = setting === false ? () => false : proxyaddr.compile(setting);
  return proxyaddr(
    {
      connection: { remoteAddress },
      socket: { remoteAddress },
      headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
    } as any,
    trust,
  );
};

describe("trust proxy", () => {
  it("tells visitors apart behind the bundled Caddy by default", () => {
    expect(clientOf({}, "127.0.0.1", "203.0.113.5")).toBe("203.0.113.5");
    expect(clientOf({}, "127.0.0.1", "198.51.100.9")).toBe("198.51.100.9");
  });

  it("ignores addresses a client put in front of the one Caddy appended", () => {
    expect(clientOf({}, "127.0.0.1", "1.2.3.4, 203.0.113.5")).toBe(
      "203.0.113.5",
    );
  });

  it("with TRUST_PROXY, stops at the first hop outside the trusted ranges", () => {
    // spoofed entry, real client, outer proxy on the private network
    expect(
      clientOf(
        { TRUST_PROXY: "true" },
        "127.0.0.1",
        "1.2.3.4, 198.51.100.7, 10.0.0.2",
      ),
    ).toBe("198.51.100.7");
  });

  it("uses TRUST_PROXY_FROM when it lists addresses", () => {
    const env = { TRUST_PROXY: "true", TRUST_PROXY_FROM: "203.0.113.10/32" };
    expect(
      clientOf(env, "127.0.0.1", "1.2.3.4, 198.51.100.7, 203.0.113.10"),
    ).toBe("198.51.100.7");
    // a private hop is not trusted once an explicit list is given
    expect(clientOf(env, "127.0.0.1", "198.51.100.7, 10.0.0.2")).toBe(
      "10.0.0.2",
    );
  });

  it("falls back to the private networks for a value Caddy could not use", () => {
    expect(
      trustProxySetting({ TRUST_PROXY: "true", TRUST_PROXY_FROM: "https://x" }),
    ).toEqual(["loopback", "uniquelocal"]);
  });

  it("trusts no proxy when Caddy is disabled and TRUST_PROXY is off", () => {
    expect(
      clientOf({ CADDY_DISABLED: "true" }, "198.51.100.1", "1.2.3.4"),
    ).toBe("198.51.100.1");
  });
});
