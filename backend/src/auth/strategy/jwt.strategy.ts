import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { User } from "@prisma/client";
import { Request } from "express";
import { Strategy } from "passport-jwt";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    config.get("internal.jwtSecret");
    super({
      jwtFromRequest: JwtStrategy.extractJWT,
      secretOrKey: config.get("internal.jwtSecret"),
    });
  }

  private static extractJWT(req: Request) {
    if (!req.cookies.access_token) return null;
    return req.cookies.access_token;
  }

  // The token names the session it was issued for. Once that session is gone,
  // signed out or revoked by an admin, the token stops working right away
  // instead of living out its 15 minutes. A token without one is refused.
  async validate(payload: {
    sub: string;
    refreshTokenId?: string;
  }): Promise<User | null> {
    if (!payload.refreshTokenId) return null;
    const session = await this.prisma.refreshToken.findFirst({
      where: {
        id: payload.refreshTokenId,
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    return session?.user ?? null;
  }
}
