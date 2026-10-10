import { GenericOidcProvider, OidcToken } from "./genericOidc.provider";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { JwtService } from "@nestjs/jwt";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { OAuthCallbackDto } from "../dto/oauthCallback.dto";
import { OAuthSignInDto } from "../dto/oauthSignIn.dto";
import { OAuthToken } from "./oauthProvider.interface";

@Injectable()
export class OidcProvider extends GenericOidcProvider {
  constructor(
    config: ConfigService,
    jwtService: JwtService,
    @Inject(CACHE_MANAGER) protected cache: Cache,
  ) {
    super(
      "oidc",
      ["oauth.oidc-enabled", "oauth.oidc-discoveryUri"],
      config,
      jwtService,
      cache,
    );
  }

  // accepts the issuer url as well as the full discovery url, people paste
  // whichever their identity provider shows them
  protected getDiscoveryUri(): string {
    const uri = (this.config.get("oauth.oidc-discoveryUri") || "")
      .trim()
      .replace(/\/+$/, "");
    if (!uri) return "";
    if (uri.includes("/.well-known/")) return uri;
    if (uri.endsWith("/.well-known")) return `${uri}/openid-configuration`;
    return `${uri}/.well-known/openid-configuration`;
  }

  getUserInfo(
    token: OAuthToken<OidcToken>,
    query: OAuthCallbackDto,
    _?: string,
  ): Promise<OAuthSignInDto> {
    const claim = this.config.get("oauth.oidc-usernameClaim") || undefined;
    const rolePath = this.config.get("oauth.oidc-rolePath") || undefined;
    const roleGeneralAccess =
      this.config.get("oauth.oidc-roleGeneralAccess") || undefined;
    const roleAdminAccess =
      this.config.get("oauth.oidc-roleAdminAccess") || undefined;
    return super.getUserInfo(token, query, claim, {
      path: rolePath,
      generalAccess: roleGeneralAccess,
      adminAccess: roleAdminAccess,
    });
  }
}
