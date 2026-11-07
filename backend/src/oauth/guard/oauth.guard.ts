import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

@Injectable()
export class OAuthGuard implements CanActivate {
  constructor() {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provider = request.params.provider;
    const state = request.query.state;
    const expected = request.cookies[`oauth_${provider}_state`];
    // both have to be there: a missing pair compared equal, which let a
    // callback through without the CSRF check doing anything
    return (
      typeof state === "string" &&
      typeof expected === "string" &&
      state.length > 0 &&
      state === expected
    );
  }
}
