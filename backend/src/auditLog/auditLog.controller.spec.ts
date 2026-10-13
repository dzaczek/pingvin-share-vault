import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { AuditLogController } from "./auditLog.controller";

// The log holds ip addresses and emails of everyone, so every route on this
// controller has to stay admin only. The guards sit on the class, a route
// added later inherits them.
describe("AuditLogController", () => {
  it("is guarded by jwt and admin on the class", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditLogController)).toEqual([
      JwtGuard,
      AdministratorGuard,
    ]);
  });

  it("does not let a route replace them", () => {
    for (const name of Object.getOwnPropertyNames(
      AuditLogController.prototype,
    )) {
      if (name === "constructor") continue;
      const handler = (AuditLogController.prototype as any)[name];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
    }
  });
});

describe("AdministratorGuard", () => {
  const context = (user?: unknown) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

  it("lets only admins through", () => {
    const guard = new AdministratorGuard();
    expect(guard.canActivate(context())).toBe(false);
    expect(guard.canActivate(context({ isAdmin: false }))).toBe(false);
    expect(guard.canActivate(context({ isAdmin: true }))).toBe(true);
  });
});
