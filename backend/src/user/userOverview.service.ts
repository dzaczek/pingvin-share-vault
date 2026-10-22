import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "src/auditLog/auditLog.service";
import { PrismaService } from "src/prisma/prisma.service";
import { getUserActiveStorageUsage } from "src/utils/storageQuota.util";
import { UserDTO } from "./dto/user.dto";

const DAY = 86_400_000;

// Everything an admin may want to know about one account, on one page. The
// histories themselves come from the audit log route, this is the rest.
@Injectable()
export class UserOverviewService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        oAuthUsers: { select: { provider: true, providerUsername: true } },
        shares: {
          orderBy: { createdAt: "desc" },
          include: {
            files: { select: { size: true } },
            security: { select: { password: true, maxViews: true } },
          },
        },
        reverseShares: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { shares: true } } },
        },
        refreshTokens: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            oauthIDToken: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    const now = new Date();

    const [storageUsed, lastLogin, failedLogins30d, identities] =
      await Promise.all([
        getUserActiveStorageUsage(this.prisma, id),
        this.prisma.auditLog.findFirst({
          where: { userId: id, action: "AUTH_LOGIN_SUCCESS" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, ipAddress: true },
        }),
        // a failed login has no account yet, only what was typed in
        this.prisma.auditLog.count({
          where: {
            action: "AUTH_LOGIN_FAILED",
            userEmail: { in: [user.email, user.username] },
            createdAt: { gt: new Date(Date.now() - 30 * DAY) },
          },
        }),
        this.identities(id),
      ]);

    return {
      user: {
        ...new UserDTO().from(user),
        hasPassword: !!user.password,
        createdAt: user.createdAt,
        oauth: user.oAuthUsers,
      },
      storageUsed,
      lastLogin,
      failedLogins30d,
      shares: user.shares.map((share) => ({
        id: share.id,
        name: share.name,
        createdAt: share.createdAt,
        expiration: share.expiration,
        // a zero date is a share that never expires
        expired: share.expiration.getTime() !== 0 && share.expiration < now,
        views: share.views,
        files: share.files.length,
        size: share.files.reduce((n, f) => n + parseInt(f.size), 0),
        scanStatus: share.scanStatus,
        blocked: !!share.blockedAt,
        removedReason: share.removedReason,
        passwordProtected: !!share.security?.password,
        maxViews: share.security?.maxViews ?? null,
      })),
      reverseShares: user.reverseShares.map((rs) => ({
        id: rs.id,
        createdAt: rs.createdAt,
        shareExpiration: rs.shareExpiration,
        remainingUses: rs.remainingUses,
        maxShareSize: rs.maxShareSize,
        shares: rs._count.shares,
      })),
      sessions: user.refreshTokens.map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        // the id token starts with the provider that issued it
        oauth: t.oauthIDToken?.split(":")[0] ?? null,
      })),
      identities,
    };
  }

  // every device, fingerprint and address the account was seen with, first
  // and last time and how often
  private async identities(userId: string) {
    const group = async (by: "deviceId" | "visitorId" | "ipAddress") => {
      const rows = await this.prisma.auditLog.groupBy({
        by: [by],
        // the empty group, entries without that value, is dropped below
        where: { userId },
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      });
      return rows
        .filter((r) => r[by])
        .map((r) => ({
          value: r[by] as string,
          count: r._count._all,
          firstSeen: r._min.createdAt,
          lastSeen: r._max.createdAt,
        }))
        .sort((a, b) => +b.lastSeen - +a.lastSeen);
    };
    const [deviceId, visitorId, ipAddress] = await Promise.all([
      group("deviceId"),
      group("visitorId"),
      group("ipAddress"),
    ]);
    return { deviceId, visitorId, ipAddress };
  }

  // the access token checks its session on every request, so this signs the
  // account out everywhere at once
  async revokeSessions(id: string, admin: { id: string; email: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { userId: id },
    });
    this.auditLog.log("AUTH_SESSIONS_REVOKED", {
      userId: admin.id,
      userEmail: admin.email,
      resourceId: id,
      resourceName: user.email,
      metadata: { sessions: count },
    });
    return { count };
  }
}
