import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { ConfigService } from "src/config/config.service";
import { SHARD_ID } from "src/constants";
import { PrismaService } from "src/prisma/prisma.service";
import { auditRequestStore, requestContext } from "./auditLog.context";

export type AuditAction =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_TOTP_REQUIRED"
  | "AUTH_LOGIN_FAILED"
  | "AUTH_SESSIONS_REVOKED"
  | "FILE_UPLOAD"
  | "FILE_DOWNLOAD"
  | "FILE_PREVIEW"
  | "SHARE_VIEW";

export type AuditEntry = {
  userId?: string;
  userEmail?: string;
  resourceId?: string;
  resourceName?: string;
  metadata?: Record<string, unknown>;
};

export type AuditLogFilter = {
  userId?: string;
  visitorId?: string;
  deviceId?: string;
  ipAddress?: string;
  shardId?: string;
  action?: string;
  resourceId?: string;
  shareId?: string;
  // the logins of one account, the failed ones matched by what was typed in
  loginsOf?: string;
  // what happened to the files of one account: views, downloads, previews
  filesOf?: string;
  cursor?: string;
  take?: string | number;
  order?: "asc" | "desc";
};

const SENSITIVE_KEY = /pass|secret|token|totp|authorization|cookie/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? "[REDACTED]" : redact(v),
      ]),
    );
  }
  return value;
}

const inShares = (ids: string[]): Prisma.AuditLogWhereInput => ({
  OR: [
    { resourceId: { in: ids } },
    ...ids.map((id) => ({ metadata: { path: "$.shareId", equals: id } })),
  ],
});

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // Fire and forget. The request context is read right here, before anything
  // is awaited, and a failed write only ends up as a warning.
  log(action: AuditAction, entry: AuditEntry = {}) {
    if (!this.config.get("security.auditLogEnabled")) return;
    const ctx = requestContext(auditRequestStore.getStore());

    this.prisma.auditLog
      .create({
        data: {
          action,
          shardId: SHARD_ID,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          visitorId: ctx.visitorId,
          deviceId: ctx.deviceId,
          userId: entry.userId ?? ctx.user?.id ?? null,
          userEmail: (entry.userEmail ?? ctx.user?.email ?? null)?.slice(
            0,
            255,
          ),
          resourceId: entry.resourceId ?? null,
          resourceName: entry.resourceName?.slice(0, 255) ?? null,
          metadata: entry.metadata
            ? (redact(entry.metadata) as Prisma.InputJsonObject)
            : undefined,
        },
      })
      .catch((err: any) =>
        this.logger.warn(
          `Failed to write audit entry ${action}: ${err?.message || "unknown error"}`,
        ),
      );
  }

  async find(filter: AuditLogFilter) {
    const take = Math.min(Math.max(parseInt(`${filter.take}`) || 50, 1), 200);
    const order = filter.order === "asc" ? "asc" : "desc";

    const where: Prisma.AuditLogWhereInput = {};
    for (const key of [
      "userId",
      "visitorId",
      "deviceId",
      "ipAddress",
      "shardId",
      "action",
      "resourceId",
    ] as const) {
      if (filter[key]) where[key] = filter[key];
    }
    // a share shows up as the resource of views and zips, and as the parent
    // in the metadata of every single file
    if (filter.shareId)
      where.OR = [
        { resourceId: filter.shareId },
        { metadata: { path: "$.shareId", equals: filter.shareId } },
      ];

    const and: Prisma.AuditLogWhereInput[] = [];

    if (filter.loginsOf) {
      const user = await this.prisma.user.findUnique({
        where: { id: filter.loginsOf },
        select: { email: true, username: true },
      });
      and.push({
        action: { startsWith: "AUTH_LOGIN" },
        OR: [
          { userId: filter.loginsOf },
          ...(user
            ? [
                {
                  action: "AUTH_LOGIN_FAILED",
                  userEmail: { in: [user.email, user.username] },
                },
              ]
            : []),
        ],
      });
    }

    if (filter.filesOf) {
      // the most recent shares are plenty for a history page
      const shares = await this.prisma.share.findMany({
        where: { creatorId: filter.filesOf },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { id: true },
      });
      and.push(
        { action: { in: ["SHARE_VIEW", "FILE_DOWNLOAD", "FILE_PREVIEW"] } },
        inShares(shares.map((s) => s.id)),
        // somebody else, a guest included, not the owner looking at it
        { OR: [{ userId: null }, { userId: { not: filter.filesOf } }] },
      );
    }
    if (and.length) where.AND = and;

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: order }, { id: order }],
      take: take + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });

    return {
      entries: rows.slice(0, take),
      nextCursor: rows.length > take ? rows[take - 1].id : null,
    };
  }

  // Traffic per shard, split by action and by storage backend. Uploads and
  // downloads carry storage and size in their metadata.
  async shardSummary() {
    const rows = await this.prisma.$queryRaw<
      {
        shardId: string;
        action: string;
        storage: string | null;
        count: number | bigint;
        bytes: number | bigint | null;
        lastSeen: string;
      }[]
    >`
      SELECT "shardId",
             "action",
             json_extract("metadata", '$.storage') AS "storage",
             COUNT(*) AS "count",
             SUM(json_extract("metadata", '$.size')) AS "bytes",
             MAX("createdAt") AS "lastSeen"
        FROM "AuditLog"
       GROUP BY "shardId", "action", "storage"
       ORDER BY "shardId", "action"`;

    return rows.map((r) => ({
      ...r,
      count: Number(r.count),
      bytes: Number(r.bytes ?? 0),
    }));
  }

  @Cron("30 3 * * *")
  async deleteExpired() {
    // 0 keeps audit entries forever
    const days = this.config.get("security.auditLogRetentionDays");
    if (!(days > 0)) return;
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const { count } = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count)
      this.logger.log(`Deleted ${count} audit entries older than ${days} days`);
  }
}
