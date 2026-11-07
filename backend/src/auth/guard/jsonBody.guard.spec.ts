import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AuthController } from "../auth.controller";
import { JsonBodyGuard } from "./jsonBody.guard";

// otplib ships ESM jest cannot load, the controller only needs the class
jest.mock("../authTotp.service", () => ({ AuthTotpService: class {} }));

// A form posted from another site to signIn could put the visitor in the
// attacker's account. Such a form can only send form or text bodies.

const contextFor = (contentType?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: contentType ? { "content-type": contentType } : {},
      }),
    }),
  }) as any;

describe("JsonBodyGuard", () => {
  const guard = new JsonBodyGuard();

  it("lets JSON through", () => {
    expect(guard.canActivate(contextFor("application/json"))).toBe(true);
    expect(
      guard.canActivate(contextFor("Application/JSON; charset=utf-8")),
    ).toBe(true);
  });

  it("refuses what a cross-site HTML form can send", () => {
    for (const type of [
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "text/plain",
      undefined,
    ]) {
      expect(() => guard.canActivate(contextFor(type))).toThrow(
        expect.objectContaining({ status: 415 }),
      );
    }
  });

  it("guards every route that sets the session cookies", () => {
    for (const route of ["signUp", "signIn", "signInTotp"]) {
      const guards =
        Reflect.getMetadata(
          GUARDS_METADATA,
          AuthController.prototype[route as keyof AuthController],
        ) ?? [];
      expect(guards).toContain(JsonBodyGuard);
    }
  });
});
