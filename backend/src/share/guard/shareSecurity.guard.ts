import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import * as moment from "moment";
import { I18nService } from "nestjs-i18n";
import { PrismaService } from "src/prisma/prisma.service";
import { ShareService } from "src/share/share.service";
import { ConfigService } from "src/config/config.service";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { User } from "@prisma/client";
import { hasConfirmedEmail } from "../recipientEmail.util";

@Injectable()
export class ShareSecurityGuard extends JwtGuard {
  constructor(
    private shareService: ShareService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    super(configService);
  }

  protected async authenticateUser(
    context: ExecutionContext,
  ): Promise<User | undefined> {
    await super.canActivate(context);
    const request: Request = context.switchToHttp().getRequest();
    return request.user as User;
  }

  protected async isRecipient(
    share: {
      id: string;
      userRecipients: { userId: string }[];
      recipients: { email: string }[];
    },
    user?: User,
  ): Promise<boolean> {
    if (!user) return false;
    if (!this.configService.get("share.enableUserRecipients")) return false;

    // Already linked as a recipient of this share.
    const isLinked = share.userRecipients.some((r) => r.userId === user.id);
    if (isLinked) return true;

    // Otherwise, if the user's confirmed email matches one of the share's
    // recipients, grant access and link them
    const userEmail = user.email?.toLowerCase();
    const isEmailRecipient =
      !!userEmail &&
      hasConfirmedEmail(
        user,
        this.configService.get("security.enableEmailVerification"),
      ) &&
      share.recipients.some((r) => r.email.toLowerCase() === userEmail);
    if (isEmailRecipient) {
      await this.prisma.shareUserRecipient.upsert({
        where: { userId_shareId: { userId: user.id, shareId: share.id } },
        create: { userId: user.id, shareId: share.id },
        update: {},
      });
      return true;
    }
    return false;
  }

  async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest();

    const shareId = Object.prototype.hasOwnProperty.call(
      request.params,
      "shareId",
    )
      ? request.params.shareId
      : request.params.id;

    const shareToken = request.cookies[`share_${shareId}_token`];

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: {
        security: true,
        reverseShare: true,
        userRecipients: { select: { userId: true } },
        recipients: { select: { email: true } },
      },
    });

    if (!share) throw new NotFoundException(this.i18n.t("share.notFound"));

    const user = await this.authenticateUser(context);

    // A blocked share is kept around for investigation. Admins always get in,
    // regardless of allowAdminAccessAllShares, since blocking is already a
    // deliberate admin action. Everyone else, the creator included, just sees
    // a not found so nobody gets tipped off.
    if (share.blockedAt) {
      if (user?.isAdmin) return true;
      throw new NotFoundException(this.i18n.t("share.notFound"));
    }

    // If admin access is enabled and user is admin, allow access
    if (
      user?.isAdmin &&
      this.configService.get("security.allowAdminAccessAllShares")
    ) {
      return true;
    }

    if (
      moment().isAfter(share.expiration) &&
      !moment(share.expiration).isSame(0)
    ) {
      throw new NotFoundException(this.i18n.t("share.notFound"));
    }

    // Called for everyone, since it also links the share to the recipient's
    // dashboard. Being a recipient only gets past the recipient restriction,
    // the password and the share token still apply.
    const isRecipient = await this.isRecipient(share, user);

    // If share is restricted to named recipients, block everyone else (excluding the creator)
    if (
      share.security?.restrictToRecipients &&
      !isRecipient &&
      (!user || share.creatorId !== user.id)
    ) {
      throw new ForbiddenException(
        this.i18n.t("share.restrictedToRecipients"),
        "share_restricted_to_recipients",
      );
    }

    if (share.security?.password && !shareToken)
      throw new ForbiddenException(
        this.i18n.t("file.passwordProtected"),
        "share_password_required",
      );

    if (!(await this.shareService.verifyShareToken(share, shareToken)))
      throw new ForbiddenException(
        this.i18n.t("share.tokenRequired"),
        "share_token_required",
      );

    // Only the creator and reverse share creator can access the reverse share if it's not public
    if (
      share.reverseShare &&
      !share.reverseShare.publicAccess &&
      share.creatorId !== user?.id &&
      share.reverseShare.creatorId !== user?.id
    )
      throw new ForbiddenException(
        this.i18n.t("share.privateShare"),
        "private_share",
      );

    return true;
  }
}
