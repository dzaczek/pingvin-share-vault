import { ForbiddenException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AuthController } from "../auth.controller";
import { ConfigController } from "../../config/config.controller";
import { UserController } from "../../user/user.controller";
import { DemoModeGuard } from "./demoMode.guard";

// only the route metadata is read here, and the totp library is esm only
jest.mock("../authTotp.service", () => ({ AuthTotpService: class {} }));

let demoMode = false;
jest.mock("../../constants", () => ({
  ...jest.requireActual("../../constants"),
  get DEMO_MODE() {
    return demoMode;
  },
}));

// A public demo hands out its admin account to anyone. Whatever that admin
// could change for everyone else, or keep from the next visitor, is turned
// off: settings, the logo, passwords and accounts. Two factor login stays,
// the data is thrown away at every reset anyway.

describe("DemoModeGuard", () => {
  const guard = new DemoModeGuard();

  it("lets everything through on a normal instance", () => {
    demoMode = false;
    expect(guard.canActivate()).toBe(true);
  });

  it("refuses in the demo", () => {
    demoMode = true;
    expect(() => guard.canActivate()).toThrow(ForbiddenException);
  });

  const saving = (body: unknown) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ body }) }) }) as any;

  it("lets the look and the download mode be tried in the demo", () => {
    demoMode = true;
    expect(
      guard.canActivate(
        saving([
          { key: "appearance.uiStyle", value: "glass" },
          { key: "share.downloadAll", value: "files" },
        ]),
      ),
    ).toBe(true);
  });

  it("lets the wallpapers that ship with the app be picked", () => {
    demoMode = true;
    for (const value of [
      "/wallpapers/dunes.svg",
      "/wallpapers/alpine-lake-day.webp",
      "/wallpapers/alpine-lake.cycle",
      "",
    ])
      expect(
        guard.canActivate(
          saving([{ key: "appearance.glassBackgroundUrl", value }]),
        ),
      ).toBe(true);
  });

  it("refuses a save that mixes in anything else", () => {
    demoMode = true;
    for (const body of [
      [
        { key: "appearance.uiStyle", value: "glass" },
        { key: "appearance.customCss", value: "body{}" },
      ],
      [{ key: "share.maxSize", value: "999999999" }],
      // every visitor would see a wallpaper picked by a stranger
      [{ key: "appearance.glassBackgroundUrl", value: "https://x.com/a.jpg" }],
      [
        {
          key: "appearance.glassBackgroundUrl",
          value: "/wallpapers/../api/x.svg",
        },
      ],
      [],
      { key: "appearance.uiStyle", value: "glass" },
    ])
      expect(() => guard.canActivate(saving(body))).toThrow(ForbiddenException);
  });
});

describe("routes closed in the demo", () => {
  const guardsOf = (controller: any, method: string) =>
    Reflect.getMetadata(GUARDS_METADATA, controller.prototype[method]) ?? [];

  it.each([
    [ConfigController, "updateMany"],
    [ConfigController, "testEmail"],
    [ConfigController, "testRedis"],
    [ConfigController, "uploadLogo"],
    [ConfigController, "uploadDarkLogo"],
    [AuthController, "updatePassword"],
    [UserController, "updateCurrentUser"],
    [UserController, "deleteCurrentUser"],
    [UserController, "update"],
    [UserController, "delete"],
  ])("%p.%s", (controller, method) => {
    expect(guardsOf(controller, method)).toContain(DemoModeGuard);
  });

  it.each([
    [AuthController, "enableTotp"],
    [UserController, "create"],
  ])("leaves %p.%s open", (controller, method) => {
    expect(guardsOf(controller, method)).not.toContain(DemoModeGuard);
  });
});
