import { Injectable } from "@nestjs/common";
import * as moment from "moment";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";

const DAY = 86_400_000;
const TOP = 10;

// what the charts count, by audit action
const DAILY = {
  SHARE_CREATE: "shares",
  FILE_UPLOAD: "uploads",
  FILE_DOWNLOAD: "downloads",
  SHARE_VIEW: "views",
  AUTH_LOGIN_SUCCESS: "logins",
  AUTH_LOGIN_FAILED: "failedLogins",
} as const;

type Counter = (typeof DAILY)[keyof typeof DAILY];
type Day = Record<Counter | "users" | "uploadBytes", number> & { day: string };

const num = (v: number | bigint | null) => Number(v ?? 0);

// The admin dashboard. What exists right now comes from the shares and files
// themselves, what happened over time from the audit log, so the history only
// reaches back as far as the audit log keeps it. Days are UTC days.
@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async get(days: number) {
    const now = new Date();
    const today = Math.floor(now.getTime() / DAY) * DAY;
    const since = new Date(today - (days - 1) * DAY);
    // dates are stored as ISO text, so a string compares the same way
    const sinceIso = since.toISOString();

    const [live, daily, shards, uploaders, downloaded, users, oldest] =
      await Promise.all([
        this.live(now),
        this.daily(sinceIso, now),
        this.shards(sinceIso),
        this.prisma.$queryRaw<
          { userId: string; count: bigint; bytes: number | bigint | null }[]
        >`
          SELECT "userId",
                 COUNT(*) AS "count",
                 SUM(json_extract("metadata", '$.size')) AS "bytes"
            FROM "AuditLog"
           WHERE "action" = 'FILE_UPLOAD'
             AND "createdAt" >= ${sinceIso}
             AND "userId" IS NOT NULL
           GROUP BY "userId"
           ORDER BY "bytes" DESC
           LIMIT ${TOP}`,
        // a download counts for whoever owns the share, which is only known
        // while the share still exists
        this.prisma.$queryRaw<{ ownerId: string; count: bigint }[]>`
          SELECT COALESCE(r."creatorId", s."creatorId") AS "ownerId",
                 COUNT(*) AS "count"
            FROM "AuditLog" a
            JOIN "Share" s ON s."id" = json_extract(a."metadata", '$.shareId')
            LEFT JOIN "ReverseShare" r ON r."id" = s."reverseShareId"
           WHERE a."action" = 'FILE_DOWNLOAD'
             AND a."createdAt" >= ${sinceIso}
             AND COALESCE(r."creatorId", s."creatorId") IS NOT NULL
           GROUP BY "ownerId"
           ORDER BY "count" DESC
           LIMIT ${TOP}`,
        this.prisma.user.findMany({
          select: { createdAt: true, isAdmin: true },
        }),
        this.prisma.auditLog.findFirst({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

    for (const user of users) {
      const day = daily.get(user.createdAt.toISOString().slice(0, 10));
      if (day) day.users++;
    }

    const byDay = [...daily.values()];
    const sum = (key: Exclude<keyof Day, "day">) =>
      byDay.reduce((n, d) => n + d[key], 0);

    const top: Record<
      string,
      { userId: string; value: number; count?: number }[]
    > = {
      shares: live.top("shares"),
      files: live.top("files"),
      storage: live.top("bytes"),
      uploads: uploaders.map((r) => ({
        userId: r.userId,
        value: num(r.bytes),
        count: num(r.count),
      })),
      downloads: downloaded.map((r) => ({
        userId: r.ownerId,
        value: num(r.count),
      })),
    };

    const names = await this.names(
      Object.values(top).flatMap((rows) => rows.map((r) => r.userId)),
    );

    return {
      days,
      since,
      generatedAt: now,
      totals: {
        users: users.length,
        admins: users.filter((u) => u.isAdmin).length,
        activeShares: live.shares,
        files: live.files,
        storage: live.bytes,
      },
      period: {
        newUsers: sum("users"),
        shares: sum("shares"),
        uploads: sum("uploads"),
        uploadBytes: sum("uploadBytes"),
        downloads: sum("downloads"),
        views: sum("views"),
        logins: sum("logins"),
        failedLogins: sum("failedLogins"),
      },
      daily: byDay,
      // a deleted account drops out of the lists
      top: Object.fromEntries(
        Object.entries(top).map(([key, rows]) => [
          key,
          rows
            .filter((r) => names.has(r.userId))
            .map(({ userId, ...r }) => ({ ...r, user: names.get(userId) })),
        ]),
      ),
      shards,
      auditLog: {
        enabled: this.config.get("security.auditLogEnabled"),
        retentionDays: this.config.get("security.auditLogRetentionDays"),
        oldest: oldest?.createdAt ?? null,
      },
    };
  }

  // completed shares that can still be opened, with the same owner rule as
  // the storage quota: a reverse share belongs to whoever handed it out
  private async live(now: Date) {
    const shares = await this.prisma.share.findMany({
      where: {
        uploadLocked: true,
        removedReason: null,
        OR: [{ expiration: { gt: now } }, { expiration: moment(0).toDate() }],
      },
      select: {
        creatorId: true,
        reverseShare: { select: { creatorId: true } },
        files: { select: { size: true } },
      },
    });

    const owners = new Map<
      string,
      { shares: number; files: number; bytes: number }
    >();
    let files = 0;
    let bytes = 0;
    for (const share of shares) {
      const size = share.files.reduce((n, f) => n + parseInt(f.size), 0);
      files += share.files.length;
      bytes += size;
      const owner = share.reverseShare?.creatorId ?? share.creatorId;
      if (!owner) continue;
      const o = owners.get(owner) ?? { shares: 0, files: 0, bytes: 0 };
      o.shares++;
      o.files += share.files.length;
      o.bytes += size;
      owners.set(owner, o);
    }

    return {
      shares: shares.length,
      files,
      bytes,
      top: (key: "shares" | "files" | "bytes") =>
        [...owners.entries()]
          .map(([userId, o]) => ({ userId, value: o[key] }))
          .filter((r) => r.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, TOP),
    };
  }

  // one entry per day, the empty days included, so the charts have no gaps
  private async daily(sinceIso: string, now: Date) {
    const rows = await this.prisma.$queryRaw<
      {
        day: string;
        action: keyof typeof DAILY;
        count: bigint;
        bytes: number | bigint | null;
      }[]
    >`
      SELECT substr("createdAt", 1, 10) AS "day",
             "action",
             COUNT(*) AS "count",
             SUM(json_extract("metadata", '$.size')) AS "bytes"
        FROM "AuditLog"
       WHERE "createdAt" >= ${sinceIso}
         AND "action" IN ('SHARE_CREATE', 'FILE_UPLOAD', 'FILE_DOWNLOAD',
                          'SHARE_VIEW', 'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILED')
       GROUP BY "day", "action"`;

    const days = new Map<string, Day>();
    for (let t = Date.parse(sinceIso); t <= now.getTime(); t += DAY) {
      const day = new Date(t).toISOString().slice(0, 10);
      days.set(day, {
        day,
        users: 0,
        shares: 0,
        uploads: 0,
        uploadBytes: 0,
        downloads: 0,
        views: 0,
        logins: 0,
        failedLogins: 0,
      });
    }
    for (const r of rows) {
      const day = days.get(r.day);
      if (!day) continue;
      day[DAILY[r.action]] += num(r.count);
      if (r.action === "FILE_UPLOAD") day.uploadBytes += num(r.bytes);
    }
    return days;
  }

  private async shards(sinceIso: string) {
    const rows = await this.prisma.$queryRaw<
      {
        shardId: string;
        action: string;
        count: bigint;
        bytes: number | bigint | null;
        lastSeen: string;
      }[]
    >`
      SELECT "shardId",
             "action",
             COUNT(*) AS "count",
             SUM(json_extract("metadata", '$.size')) AS "bytes",
             MAX("createdAt") AS "lastSeen"
        FROM "AuditLog"
       WHERE "createdAt" >= ${sinceIso}
       GROUP BY "shardId", "action"`;

    const shards = new Map<
      string,
      {
        shardId: string;
        uploads: number;
        uploadBytes: number;
        downloads: number;
        views: number;
        logins: number;
        lastSeen: string;
      }
    >();
    for (const r of rows) {
      const s = shards.get(r.shardId) ?? {
        shardId: r.shardId,
        uploads: 0,
        uploadBytes: 0,
        downloads: 0,
        views: 0,
        logins: 0,
        lastSeen: r.lastSeen,
      };
      if (r.lastSeen > s.lastSeen) s.lastSeen = r.lastSeen;
      if (r.action === "FILE_UPLOAD") {
        s.uploads += num(r.count);
        s.uploadBytes += num(r.bytes);
      }
      if (r.action === "FILE_DOWNLOAD") s.downloads += num(r.count);
      if (r.action === "SHARE_VIEW") s.views += num(r.count);
      if (r.action === "AUTH_LOGIN_SUCCESS") s.logins += num(r.count);
      shards.set(r.shardId, s);
    }
    return [...shards.values()].sort((a, b) =>
      a.shardId.localeCompare(b.shardId),
    );
  }

  private async names(ids: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, username: true, email: true, displayName: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }
}
