import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { User } from "@prisma/client";
import {
  generateSecret,
  generateURI,
  generate,
  verify,
  createGuardrails,
} from "otplib";
import * as qrcode from "qrcode-svg";
import { I18nService } from "nestjs-i18n";
import { AuditLogService } from "src/auditLog/auditLog.service";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthService } from "./auth.service";
import { AuthSignInTotpDTO } from "./dto/authSignInTotp.dto";

const legacyGuardrails = createGuardrails({
  MIN_SECRET_BYTES: 10,
});

@Injectable()
export class AuthTotpService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private authService: AuthService,
    private readonly i18n: I18nService,
    private auditLog: AuditLogService,
  ) {}

  async signInTotp(dto: AuthSignInTotpDTO) {
    const token = await this.prisma.loginToken.findFirst({
      where: {
        token: dto.loginToken,
      },
      include: {
        user: true,
      },
    });

    if (!token || token.used) {
      this.auditLog.log("AUTH_LOGIN_FAILED", {
        userId: token?.user.id,
        userEmail: token?.user.email,
        metadata: { method: "totp", reason: "invalid_login_token" },
      });
      throw new UnauthorizedException(this.i18n.t("auth.invalidLoginToken"));
    }

    if (token.expiresAt < new Date()) {
      this.auditLog.log("AUTH_LOGIN_FAILED", {
        userId: token.user.id,
        userEmail: token.user.email,
        metadata: { method: "totp", reason: "login_token_expired" },
      });
      throw new UnauthorizedException(
        this.i18n.t("auth.loginTokenExpired"),
        "token_expired",
      );
    }

    // Check the TOTP code
    const { totpSecret } = token.user;

    if (!totpSecret) {
      throw new BadRequestException(this.i18n.t("auth.totpNotEnabled"));
    }

    const verified = await verify({
      token: dto.totp,
      secret: totpSecret,
      guardrails: legacyGuardrails,
    });
    if (!verified.valid) {
      this.auditLog.log("AUTH_LOGIN_FAILED", {
        userId: token.user.id,
        userEmail: token.user.email,
        metadata: { method: "totp", reason: "invalid_code" },
      });
      throw new BadRequestException(this.i18n.t("auth.invalidCode"));
    }

    // Set the login token to used
    await this.prisma.loginToken.update({
      where: { token: token.token },
      data: { used: true },
    });

    const { refreshToken, refreshTokenId } =
      await this.authService.createRefreshToken(token.user.id);
    const accessToken = await this.authService.createAccessToken(
      token.user,
      refreshTokenId,
    );

    this.auditLog.log("AUTH_LOGIN_SUCCESS", {
      userId: token.user.id,
      userEmail: token.user.email,
      metadata: { method: "totp" },
    });

    return { accessToken, refreshToken };
  }

  async enableTotp(user: User, password: string) {
    if (!(await this.authService.verifyPassword(user, password)))
      throw new ForbiddenException(this.i18n.t("auth.invalidPassword"));

    // Check if we have a secret already
    const { totpVerified } = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { totpVerified: true },
    });

    if (totpVerified) {
      throw new BadRequestException(this.i18n.t("auth.totpAlreadyEnabled"));
    }

    const issuer = this.configService.get("general.appName");
    const secret = generateSecret();

    const otpURL = generateURI({
      issuer: issuer,
      label: user.username || user.email,
      secret: secret,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
        totpSecret: secret,
      },
    });

    // TODO: Maybe we should generate the QR code on the client rather than the server?
    const qrCode = new qrcode({
      content: otpURL,
      container: "svg-viewbox",
      join: true,
    }).svg();

    return {
      totpAuthUrl: otpURL,
      totpSecret: secret,
      qrCode:
        "data:image/svg+xml;base64," + Buffer.from(qrCode).toString("base64"),
    };
  }

  async verifyTotp(user: User, password: string, code: string) {
    if (!(await this.authService.verifyPassword(user, password)))
      throw new ForbiddenException(this.i18n.t("auth.invalidPassword"));

    const { totpSecret } = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { totpSecret: true },
    });

    if (!totpSecret) {
      throw new BadRequestException(this.i18n.t("auth.totpNotInProgress"));
    }

    const expected = await generate({
      secret: totpSecret,
      guardrails: legacyGuardrails,
    });

    if (code !== expected) {
      throw new BadRequestException(this.i18n.t("auth.invalidCode"));
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpVerified: true,
      },
    });

    return true;
  }

  async disableTotp(user: User, password: string, code: string) {
    if (!(await this.authService.verifyPassword(user, password)))
      throw new ForbiddenException(this.i18n.t("auth.invalidPassword"));

    const { totpSecret } = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { totpSecret: true },
    });

    if (!totpSecret) {
      throw new BadRequestException(this.i18n.t("auth.totpNotEnabled"));
    }

    const expected = await generate({
      secret: totpSecret,
      guardrails: legacyGuardrails,
    });

    if (code !== expected) {
      throw new BadRequestException(this.i18n.t("auth.invalidCode"));
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpVerified: false,
        totpEnabled: false,
        totpSecret: null,
      },
    });

    return true;
  }
}
