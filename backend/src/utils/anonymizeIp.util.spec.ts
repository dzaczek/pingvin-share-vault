import { Request } from "express";
import { anonymizeIp, anonymizeIpMiddleware, maskIp } from "./anonymizeIp.util";

// With ANONYMIZE_IP on, no full address of a visitor is kept anywhere: not in
// the share access log, not in the audit log, not in the server log. The last
// part of the address is dropped the moment the request comes in, the way
// analytics tools usually do it.

describe("anonymizeIp", () => {
  it("drops the last octet of an IPv4 address", () => {
    expect(anonymizeIp("203.0.113.57")).toBe("203.0.113.0");
  });

  it("keeps the IPv4 form of an IPv4 mapped IPv6 address", () => {
    expect(anonymizeIp("::ffff:203.0.113.57")).toBe("203.0.113.0");
  });

  it("keeps only the first 48 bits of an IPv6 address", () => {
    expect(anonymizeIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe(
      "2001:db8:85a3::",
    );
  });

  it("expands a shortened IPv6 address before cutting it", () => {
    expect(anonymizeIp("2001:db8::1")).toBe("2001:db8:0::");
    expect(anonymizeIp("::1")).toBe("0:0:0::");
  });

  it("leaves anything that is not an address alone", () => {
    expect(anonymizeIp("")).toBe("");
    expect(anonymizeIp(undefined)).toBeUndefined();
  });
});

// ANONYMIZE_IP=mask is for showing addresses in public, like the demo: only
// the first and the last part stay, which reads like an address but hides
// more of it than the shortened form
describe("maskIp", () => {
  it("keeps the first and the last octet of an IPv4 address", () => {
    expect(maskIp("203.0.113.57")).toBe("203.*.*.57");
  });

  it("masks an IPv4 mapped IPv6 address as IPv4", () => {
    expect(maskIp("::ffff:203.0.113.57")).toBe("203.*.*.57");
  });

  it("keeps the first and the last group of an IPv6 address", () => {
    expect(maskIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:*:7348");
    expect(maskIp("2001:db8::1")).toBe("2001:*:1");
    expect(maskIp("::1")).toBe("0:*:1");
  });

  it("leaves anything that is not an address alone", () => {
    expect(maskIp("")).toBe("");
    expect(maskIp(undefined)).toBeUndefined();
  });
});

describe("anonymizeIpMiddleware", () => {
  const run = (mode: string) => {
    const req = Object.create({ ip: "203.0.113.57" }) as Request;
    const next = jest.fn();
    anonymizeIpMiddleware(mode)!(req, {} as any, next);
    expect(next).toHaveBeenCalled();
    return req.ip;
  };

  it("hands the rest of the app the shortened address", () => {
    expect(run("true")).toBe("203.0.113.0");
  });

  it("hands the rest of the app the masked address", () => {
    expect(run("mask")).toBe("203.*.*.57");
  });

  it("is not there when the setting is off or unknown", () => {
    expect(anonymizeIpMiddleware(undefined)).toBeUndefined();
    expect(anonymizeIpMiddleware("false")).toBeUndefined();
    expect(anonymizeIpMiddleware("yes")).toBeUndefined();
  });
});
