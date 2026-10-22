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
  // instead of living out its 15 minutes.
  async validate(payload: { sub: string; refreshTokenId?: string }) {
    const user: User = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        ...(payload.refreshTokenId && {
          refreshTokens: { some: { id: payload.refreshTokenId } },
        }),
      },
    });
    return user;
  }
}
