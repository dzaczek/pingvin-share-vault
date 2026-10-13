import { Request } from "express";
import { anonymizeIp, anonymizeIpMiddleware } from "./anonymizeIp.util";

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

describe("anonymizeIpMiddleware", () => {
  it("hands the rest of the app the shortened address", () => {
    const req = Object.create({ ip: "203.0.113.57" }) as Request;
    const next = jest.fn();

    anonymizeIpMiddleware(req, {} as any, next);

    expect(req.ip).toBe("203.0.113.0");
    expect(next).toHaveBeenCalled();
  });
});
