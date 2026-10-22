import { NotFoundException } from "@nestjs/common";
import { UserOverviewService } from "./userOverview.service";

// The admin's page about one account. The numbers on it are derived here, so
// these check the derivations rather than the queries.

const day = 86_400_000;

const user = {
  id: "u1",
  email: "jan@example.invalid",
  username: "jan",
  password: "hash",
  isAdmin: false,
  isActivated: true,
  ldapDN: null,
  totpVerified: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  oAuthUsers: [{ provider: "github", providerUsername: "jan" }],
  shares: [
    {
      id: "live",
      name: "live",
      createdAt: new Date(),
      expiration: new Date(Date.now() + day),
      views: 3,
      scanStatus: "CLEAN",
      blockedAt: null,
      removedReason: null,
      files: [{ size: "10" }, { size: "32" }],
      security: { password: "x", maxViews: 5 },
    },
    {
      id: "old",
      name: null,
      createdAt: new Date(),
      expiration: new Date(Date.now() - day),
      views: 0,
      scanStatus: "PENDING",
      blockedAt: new Date(),
      removedReason: null,
      files: [],
      security: null,
    },
    {
      id: "forever",
      name: null,
      createdAt: new Date(),
      expiration: new Date(0),
      views: 0,
      scanStatus: "CLEAN",
      blockedAt: null,
      removedReason: null,
      files: [],
      security: null,
    },
  ],
  reverseShares: [
    {
      id: "rs",
      createdAt: new Date(),
      shareExpiration: new Date(),
      remainingUses: 2,
      maxShareSize: "1000",
      _count: { shares: 4 },
    },
  ],
  refreshTokens: [
    {
      id: "t1",
      createdAt: new Date(),
      expiresAt: new Date(),
      oauthIDToken: null,
    },
    {
      id: "t2",
      createdAt: new Date(),
      expiresAt: new Date(),
      oauthIDToken: "github:abc",
    },
  ],
};

const build = (found: unknown = user) => {
  const logged: any[] = [];
  const counted: any[] = [];
  const deleted: any[] = [];
  const prisma = {
    user: { findUnique: async () => found },
    file: { findMany: async () => [{ size: "42" }] },
    refreshToken: {
      deleteMany: async (args: any) => {
        deleted.push(args);
        return { count: 2 };
      },
    },
    auditLog: {
      findFirst: async () => ({
        createdAt: new Date(),
        ipAddress: "192.0.2.1",
      }),
      count: async (args: any) => {
        counted.push(args);
        return 3;
      },
      groupBy: async ({ by }: any) =>
        by[0] === "ipAddress"
          ? [
              {
                ipAddress: "192.0.2.1",
                _count: { _all: 2 },
                _min: { createdAt: new Date(1) },
                _max: { createdAt: new Date(5) },
              },
              {
                ipAddress: "192.0.2.2",
                _count: { _all: 1 },
                _min: { createdAt: new Date(2) },
                _max: { createdAt: new Date(9) },
              },
            ]
          : [],
    },
  };
  const auditLog = { log: (...args: any[]) => logged.push(args) };
  return {
    service: new UserOverviewService(prisma as any, auditLog as any),
    logged,
    counted,
    deleted,
  };
};

describe("UserOverviewService.get", () => {
  it("sums the files of each share and tells expired ones apart", async () => {
    const { shares } = await build().service.get("u1");

    expect(shares.map((s) => [s.id, s.expired, s.size, s.files])).toEqual([
      ["live", false, 42, 2],
      ["old", true, 0, 0],
      // a zero date never expires
      ["forever", false, 0, 0],
    ]);
    expect(shares[0]).toMatchObject({ passwordProtected: true, maxViews: 5 });
    expect(shares[1]).toMatchObject({
      blocked: true,
      passwordProtected: false,
    });
  });

  it("counts failed logins by the email or the username typed in", async () => {
    const { service, counted } = build();
    const overview = await service.get("u1");

    expect(overview.failedLogins30d).toBe(3);
    expect(counted[0].where).toMatchObject({
      action: "AUTH_LOGIN_FAILED",
      userEmail: { in: ["jan@example.invalid", "jan"] },
    });
  });

  it("names the provider of an oauth session and never the token", async () => {
    const { sessions } = await build().service.get("u1");

    expect(sessions.map((s) => s.oauth)).toEqual([null, "github"]);
    expect(JSON.stringify(sessions)).not.toContain("abc");
  });

  it("keeps the password hash and the totp secret out", async () => {
    const overview = await build().service.get("u1");

    expect(overview.user).toMatchObject({
      hasPassword: true,
      totpVerified: true,
    });
    expect(JSON.stringify(overview)).not.toContain("hash");
  });

  it("lists addresses with the most recent first", async () => {
    const { identities } = await build().service.get("u1");

    expect(identities.ipAddress.map((i) => [i.value, i.count])).toEqual([
      ["192.0.2.2", 1],
      ["192.0.2.1", 2],
    ]);
  });

  it("is not found for an unknown account", async () => {
    await expect(build(null).service.get("nope")).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("UserOverviewService.revokeSessions", () => {
  it("drops every session and writes who did it to the audit log", async () => {
    const { service, deleted, logged } = build();

    const result = await service.revokeSessions("u1", {
      id: "admin",
      email: "admin@example.invalid",
    });

    expect(result).toEqual({ count: 2 });
    expect(deleted[0]).toEqual({ where: { userId: "u1" } });
    expect(logged[0]).toEqual([
      "AUTH_SESSIONS_REVOKED",
      {
        userId: "admin",
        userEmail: "admin@example.invalid",
        resourceId: "u1",
        resourceName: "jan@example.invalid",
        metadata: { sessions: 2 },
      },
    ]);
  });
});
