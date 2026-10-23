import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { StatsService } from "src/stats/stats.service";
import { DB_PATH } from "./setup";

// The dashboard groups by day and reads json out of the audit log in raw SQL,
// which a mocked database would happily accept whatever it says.
//
//   npm run test:db

let prisma: PrismaClient;
let service: StatsService;

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

const audit = (action: string, data: Record<string, unknown> = {}) =>
  prisma.auditLog.create({
    data: { action, ipAddress: "192.0.2.1", userAgent: "test", ...data },
  });

const share = (data: Record<string, unknown>, sizes: string[]) =>
  prisma.share.create({
    data: {
      uploadLocked: true,
      expiration: new Date(Date.now() + DAY),
      ...data,
      files: { create: sizes.map((size, i) => ({ name: `f${i}`, size })) },
    },
  });

let alice: { id: string };
let bob: { id: string };

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: DB_PATH }),
  });
  await prisma.$connect();
  service = new StatsService(
    prisma as any,
    {
      get: (key: string) => (key === "security.auditLogEnabled" ? true : 90),
    } as any,
  );

  await prisma.auditLog.deleteMany();
  await prisma.share.deleteMany();
  await prisma.user.deleteMany();

  alice = await prisma.user.create({
    data: { username: "alice", email: "alice@example.invalid" },
  });
  bob = await prisma.user.create({
    data: {
      username: "bob",
      email: "bob@example.invalid",
      isAdmin: true,
      createdAt: ago(60),
    },
  });

  const holiday = await share({ id: "holiday", creatorId: alice.id }, [
    "10",
    "20",
  ]);
  // none of these count as stored right now
  await share({ creatorId: alice.id, expiration: ago(1) }, ["1000"]);
  await share({ creatorId: alice.id, uploadLocked: false }, ["1000"]);
  await share({ creatorId: alice.id, removedReason: "virus" }, ["1000"]);
  // kept forever, and a guest upload into bob's reverse share is bob's
  await share({ creatorId: bob.id, expiration: new Date(0) }, ["5"]);
  const inbox = await prisma.reverseShare.create({
    data: {
      creatorId: bob.id,
      shareExpiration: new Date(Date.now() + DAY),
      maxShareSize: "1000000",
      sendEmailNotification: false,
      remainingUses: 1,
    },
  });
  await share({ reverseShareId: inbox.id }, ["300"]);

  await audit("FILE_UPLOAD", {
    userId: alice.id,
    metadata: { size: 10 },
    shardId: "node-a",
  });
  await audit("FILE_UPLOAD", {
    userId: alice.id,
    metadata: { size: 20 },
    shardId: "node-b",
  });
  await audit("FILE_UPLOAD", { userId: bob.id, metadata: { size: 5 } });
  // outside a 30 day window
  await audit("FILE_UPLOAD", {
    userId: bob.id,
    metadata: { size: 9999 },
    createdAt: ago(40),
  });
  for (let i = 0; i < 3; i++)
    await audit("FILE_DOWNLOAD", { metadata: { shareId: holiday.id } });
  // a share that is gone counts for the day, but for nobody
  await audit("FILE_DOWNLOAD", { metadata: { shareId: "deleted" } });
  await audit("SHARE_CREATE", { createdAt: ago(2), resourceId: holiday.id });
  await audit("AUTH_LOGIN_SUCCESS", { userId: alice.id });
  await audit("AUTH_LOGIN_FAILED");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("StatsService against sqlite", () => {
  it("counts what is stored right now", async () => {
    const stats = await service.get(30);
    expect(stats.totals).toEqual({
      users: 2,
      admins: 1,
      activeShares: 3,
      files: 4,
      storage: 335,
    });
  });

  it("has one entry per day, the quiet ones included", async () => {
    const stats = await service.get(7);
    expect(stats.daily).toHaveLength(7);
    const today = stats.daily[6];
    expect(today.day).toBe(new Date().toISOString().slice(0, 10));
    expect(today).toMatchObject({
      uploads: 3,
      uploadBytes: 35,
      downloads: 4,
      logins: 1,
      failedLogins: 1,
      users: 1,
    });
    expect(stats.daily[4].shares).toBe(1);
    expect(stats.daily[0]).toMatchObject({ uploads: 0, downloads: 0 });
  });

  it("only counts the chosen period", async () => {
    expect((await service.get(30)).period).toMatchObject({
      uploads: 3,
      uploadBytes: 35,
      downloads: 4,
      shares: 1,
      newUsers: 1,
    });
    expect((await service.get(90)).period).toMatchObject({
      uploads: 4,
      uploadBytes: 10034,
      newUsers: 2,
    });
  });

  it("ranks the users", async () => {
    const { top } = await service.get(30);
    const names = (rows: any[]) => rows.map((r) => [r.user.username, r.value]);
    expect(names(top.shares)).toEqual([
      ["bob", 2],
      ["alice", 1],
    ]);
    expect(names(top.storage)).toEqual([
      ["bob", 305],
      ["alice", 30],
    ]);
    expect(names(top.uploads)).toEqual([
      ["alice", 30],
      ["bob", 5],
    ]);
    expect(top.uploads[0].count).toBe(2);
    expect(names(top.downloads)).toEqual([["alice", 3]]);
    // nothing about the account beyond what names it
    expect(Object.keys(top.shares[0].user).sort()).toEqual([
      "displayName",
      "email",
      "id",
      "username",
    ]);
  });

  it("splits the traffic by shard", async () => {
    const { shards } = await service.get(30);
    expect(shards.map((s) => [s.shardId, s.uploads, s.uploadBytes])).toEqual([
      ["main-node", 1, 5],
      ["node-a", 1, 10],
      ["node-b", 1, 20],
    ]);
  });
});
