import {
  auditRequestMiddleware,
  auditRequestStore,
  requestContext,
} from "./auditLog.context";

const request = (headers: Record<string, string> = {}, cookies = {}) =>
  ({
    ip: "198.51.100.1",
    headers,
    cookies,
    header: (name: string) => headers[name.toLowerCase()],
  }) as any;

describe("requestContext", () => {
  it("reads the fingerprint header first", () => {
    const ctx = requestContext(
      request(
        { "x-browser-fingerprint": "ab".repeat(16) },
        { visitor_id: "cd".repeat(16) },
      ),
    );
    expect(ctx.visitorId).toBe("ab".repeat(16));
  });

  it("falls back to the cookie, which plain downloads carry", () => {
    const ctx = requestContext(request({}, { visitor_id: "cd".repeat(16) }));
    expect(ctx.visitorId).toBe("cd".repeat(16));
  });

  it("drops a visitor id that does not look like ours", () => {
    expect(
      requestContext(request({ "x-browser-fingerprint": "<script>" }))
        .visitorId,
    ).toBeNull();
    expect(
      requestContext(request({ "x-browser-fingerprint": "a".repeat(200) }))
        .visitorId,
    ).toBeNull();
  });

  it("cuts a long user agent", () => {
    const ctx = requestContext(request({ "user-agent": "x".repeat(5000) }));
    expect(ctx.userAgent).toHaveLength(512);
  });

  it("returns empty values without a request", () => {
    expect(requestContext(undefined)).toEqual({
      ipAddress: "",
      userAgent: "",
      visitorId: null,
      user: undefined,
    });
  });
});

describe("auditRequestMiddleware", () => {
  it("keeps the request reachable across awaits", async () => {
    const req = request();
    let seen: unknown;
    await new Promise<void>((resolve) =>
      auditRequestMiddleware(req, {} as any, async () => {
        await Promise.resolve();
        seen = auditRequestStore.getStore();
        resolve();
      }),
    );
    expect(seen).toBe(req);
  });
});
