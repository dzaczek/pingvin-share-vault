import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import * as moment from "moment";
import { I18nService } from "nestjs-i18n";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { ShareService } from "src/share/share.service";
import { ShareSecurityGuard } from "./shareSecurity.guard";

// Issuing a share token counts a view, so it has to apply the same access
// rules as reading the share. Checking only that the share exists let anyone
// with the link use up maxViews of a share restricted to recipients, a private
// reverse share or a blocked share, locking out the people it was meant for.
// The password itself is checked by ShareService.getShareToken.
@Injectable()
export class ShareTokenSecurity extends ShareSecurityGuard {
  constructor(
    shareService: ShareService,
    private readonly tokenPrisma: PrismaService,
    private readonly tokenConfig: ConfigService,
    private readonly tokenI18n: I18nService,
  ) {
    super(shareService, tokenPrisma, tokenConfig, tokenI18n);
  }

  async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest();
    const shareId = Object.prototype.hasOwnProperty.call(
      request.params,
      "shareId",
    )
      ? request.params.shareId
      : request.params.id;

    const share = await this.tokenPrisma.share.findUnique({
      where: { id: shareId },
      include: {
        security: true,
        reverseShare: true,
        userRecipients: { select: { userId: true } },
        recipients: { select: { email: true } },
      },
    });

    if (!share) throw new NotFoundException(this.tokenI18n.t("share.notFound"));

    const user = await this.authenticateUser(context);

    if (share.blockedAt) {
      if (user?.isAdmin) return true;
      throw new NotFoundException(this.tokenI18n.t("share.notFound"));
    }

    if (
      user?.isAdmin &&
      this.tokenConfig.get("security.allowAdminAccessAllShares")
    )
      return true;

    if (
      moment().isAfter(share.expiration) &&
      !moment(share.expiration).isSame(0)
    )
      throw new NotFoundException(this.tokenI18n.t("share.notFound"));

    const isCreator = !!user && share.creatorId === user.id;

    if (
      share.security?.restrictToRecipients &&
      !isCreator &&
      !(await this.isRecipient(share, user))
    )
      throw new ForbiddenException(
        this.tokenI18n.t("share.restrictedToRecipients"),
        "share_restricted_to_recipients",
      );

    if (
      share.reverseShare &&
      !share.reverseShare.publicAccess &&
      !isCreator &&
      share.reverseShare.creatorId !== user?.id
    )
      throw new ForbiddenException(
        this.tokenI18n.t("share.privateShare"),
        "private_share",
      );

    return true;
  }
}
