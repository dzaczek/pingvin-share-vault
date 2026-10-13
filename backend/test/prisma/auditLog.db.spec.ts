import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { AuditLogService } from "src/auditLog/auditLog.service";
import { DB_PATH } from "./setup";

// The audit log is the one table that promises its rows never change, and its
// retention job is the one place that deletes them. Both are pinned against a
// real SQLite file here, the unit tests mock the database away.
//
//   npm run test:db

let prisma: PrismaClient;
let service: AuditLogService;

const DAY = 86_400_000;

const entry = (data: Record<string, unknown> = {}) =>
  prisma.auditLog.create({
    data: {
      action: "SHARE_VIEW",
      ipAddress: "192.0.2.1",
      userAgent: "test",
      ...data,
    },
  });

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: DB_PATH }),
  });
  await prisma.$connect();
  service = new AuditLogService(prisma as any);
  (service as any).logger = { log: () => undefined, warn: () => undefined };
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AuditLog table", () => {
  it("refuses to update an entry", async () => {
    const row = await entry();
    await expect(
      prisma.auditLog.update({
        where: { id: row.id },
        data: { action: "AUTH_LOGIN_SUCCESS" },
      }),
    ).rejects.toThrow();
    // prisma words the trigger's abort as a foreign key error, so the proof
    // is the row itself
    const back = await prisma.auditLog.findUnique({ where: { id: row.id } });
    expect(back?.action).toBe("SHARE_VIEW");
  });

  it("stores metadata as json and reads it back", async () => {
    const row = await entry({ metadata: { size: 42, storage: "LOCAL" } });
    const back = await prisma.auditLog.findUnique({ where: { id: row.id } });
    expect(back?.metadata).toEqual({ size: 42, storage: "LOCAL" });
  });
});

describe("AuditLogService against sqlite", () => {
  it("pages through entries newest first with a cursor", async () => {
    for (let i = 0; i < 5; i++)
      await entry({
        createdAt: new Date(Date.now() - i * 1000),
        resourceId: `${i}`,
      });

    const first = await service.find({ take: 2 });
    const second = await service.find({ take: 2, cursor: first.nextCursor! });
    const third = await service.find({ take: 2, cursor: second.nextCursor! });

    expect(
      [...first.entries, ...second.entries, ...third.entries].map(
        (e) => e.resourceId,
      ),
    ).toEqual(["0", "1", "2", "3", "4"]);
    expect(third.nextCursor).toBeNull();
  });

  it("filters by ip", async () => {
    await entry({ ipAddress: "192.0.2.1" });
    await entry({ ipAddress: "192.0.2.2" });
    const page = await service.find({ ipAddress: "192.0.2.2" });
    expect(page.entries).toHaveLength(1);
  });

  it("sums traffic per shard, action and storage", async () => {
    await entry({
      action: "FILE_UPLOAD",
      metadata: { size: 10, storage: "LOCAL" },
    });
    await entry({
      action: "FILE_UPLOAD",
      metadata: { size: 5, storage: "LOCAL" },
    });
    await entry({
      action: "FILE_UPLOAD",
      metadata: { size: 7, storage: "S3" },
    });
    await entry({ action: "SHARE_VIEW", shardId: "node-2" });

    const summary = await service.shardSummary();

    expect(
      summary.map(({ shardId, action, storage, count, bytes }) => ({
        shardId,
        action,
        storage,
        count,
        bytes,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          shardId: "main-node",
          action: "FILE_UPLOAD",
          storage: "LOCAL",
          count: 2,
          bytes: 15,
        },
        {
          shardId: "main-node",
          action: "FILE_UPLOAD",
          storage: "S3",
          count: 1,
          bytes: 7,
        },
        {
          shardId: "node-2",
          action: "SHARE_VIEW",
          storage: null,
          count: 1,
          bytes: 0,
        },
      ]),
    );
  });

  it("deletes only entries past the retention period", async () => {
    await entry({
      createdAt: new Date(Date.now() - 91 * DAY),
      resourceId: "old",
    });
    await entry({
      createdAt: new Date(Date.now() - 89 * DAY),
      resourceId: "recent",
    });
    await entry({ resourceId: "now" });

    await service.deleteExpired();

    const left = await prisma.auditLog.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(left.map((e) => e.resourceId)).toEqual(["recent", "now"]);
  });
});
