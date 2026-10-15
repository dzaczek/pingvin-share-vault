import { auditRequestStore } from "./auditLog.context";
import { AuditLogService, redact } from "./auditLog.service";

const build = (create: (args: any) => Promise<unknown> = async () => ({})) => {
  const created: any[] = [];
  const warnings: string[] = [];
  const findManyCalls: any[] = [];
  let rows: any[] = [];

  const prisma = {
    auditLog: {
      create: (args: any) => {
        created.push(args.data);
        return create(args);
      },
      findMany: async (args: any) => {
        findManyCalls.push(args);
        return rows;
      },
    },
  };

  const service = new AuditLogService(prisma as any, { get: () => 90 } as any);
  (service as any).logger = { warn: (m: string) => void warnings.push(m) };

  return {
    service,
    created,
    warnings,
    findManyCalls,
    setRows: (r: any[]) => (rows = r),
  };
};

const request = (extra: any = {}) =>
  ({
    ip: "203.0.113.7",
    cookies: {},
    headers: {},
    header(name: string) {
      return this.headers[name.toLowerCase()];
    },
    ...extra,
  }) as any;

const flush = () => new Promise((r) => setImmediate(r));

describe("redact", () => {
  it("hides sensitive keys at any depth and keeps the rest", () => {
    expect(
      redact({
        email: "a@b.c",
        password: "hunter2",
        nested: { newPassword: "x", totp: "123456", size: 10 },
        list: [{ refreshToken: "t", name: "f" }],
      }),
    ).toEqual({
      email: "a@b.c",
      password: "[REDACTED]",
      nested: { newPassword: "[REDACTED]", totp: "[REDACTED]", size: 10 },
      list: [{ refreshToken: "[REDACTED]", name: "f" }],
    });
  });

  it("leaves non plain values alone", () => {
    const date = new Date(0);
    expect(redact({ at: date })).toEqual({ at: date });
    expect(redact("plain")).toBe("plain");
  });
});

describe("AuditLogService.log", () => {
  it("fills ip, user agent, visitor and user from the current request", async () => {
    const { service, created } = build();
    const req = request({
      headers: {
        "user-agent": "curl/8",
        "x-browser-fingerprint": "a".repeat(32),
      },
      user: { id: "u1", email: "u1@example.invalid" },
    });

    auditRequestStore.run(req, () =>
      service.log("SHARE_VIEW", { resourceId: "s1", resourceName: "docs" }),
    );
    await flush();

    expect(created[0]).toMatchObject({
      action: "SHARE_VIEW",
      ipAddress: "203.0.113.7",
      userAgent: "curl/8",
      visitorId: "a".repeat(32),
      userId: "u1",
      userEmail: "u1@example.invalid",
      resourceId: "s1",
      resourceName: "docs",
      shardId: "main-node",
    });
  });

  it("prefers the user given by the caller over the request one", async () => {
    const { service, created } = build();
    auditRequestStore.run(request({ user: { id: "admin" } }), () =>
      service.log("AUTH_LOGIN_SUCCESS", {
        userId: "u2",
        userEmail: "u2@example.invalid",
      }),
    );
    await flush();
    expect(created[0]).toMatchObject({
      userId: "u2",
      userEmail: "u2@example.invalid",
    });
  });

  it("works outside of a request, for jobs", async () => {
    const { service, created } = build();
    service.log("FILE_UPLOAD");
    await flush();
    expect(created[0]).toMatchObject({
      ipAddress: "",
      userAgent: "",
      visitorId: null,
      userId: null,
    });
  });

  it("redacts metadata before it is written", async () => {
    const { service, created } = build();
    service.log("AUTH_LOGIN_FAILED", {
      metadata: { reason: "wrong_credentials", password: "hunter2" },
    });
    await flush();
    expect(created[0].metadata).toEqual({
      reason: "wrong_credentials",
      password: "[REDACTED]",
    });
  });

  it("never throws when the write fails", async () => {
    const { service, warnings } = build(async () => {
      throw new Error("disk full");
    });
    expect(() => service.log("FILE_DOWNLOAD")).not.toThrow();
    await flush();
    expect(warnings[0]).toContain("disk full");
  });
});

describe("AuditLogService.find", () => {
  it("passes filters through and returns a cursor when there is more", async () => {
    const { service, findManyCalls, setRows } = build();
    setRows([{ id: "1" }, { id: "2" }, { id: "3" }]);

    const page = await service.find({ ipAddress: "203.0.113.7", take: "2" });

    expect(findManyCalls[0].where).toEqual({ ipAddress: "203.0.113.7" });
    expect(findManyCalls[0].take).toBe(3);
    expect(page.entries.map((e: any) => e.id)).toEqual(["1", "2"]);
    expect(page.nextCursor).toBe("2");
  });

  it("continues after the cursor and reports the end", async () => {
    const { service, findManyCalls, setRows } = build();
    setRows([{ id: "3" }]);

    const page = await service.find({ cursor: "2", order: "asc" });

    expect(findManyCalls[0]).toMatchObject({
      cursor: { id: "2" },
      skip: 1,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(page.nextCursor).toBeNull();
  });

  it("clamps the page size", async () => {
    const { service, findManyCalls } = build();
    await service.find({ take: "100000" });
    await service.find({ take: "nope" });
    expect(findManyCalls[0].take).toBe(201);
    expect(findManyCalls[1].take).toBe(51);
  });
});
