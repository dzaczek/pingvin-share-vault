import { CanActivate, ForbiddenException, Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { DEMO_MODE } from "src/constants";

// In the public demo anyone can be the admin, so nobody may change what the
// next visitor sees or lock them out. Does nothing on a normal instance.
@Injectable()
export class DemoModeGuard implements CanActivate {
  canActivate() {
    if (!DEMO_MODE) return true;
    throw new ForbiddenException(
      I18nContext.current()?.t("config.disabledInDemo") ??
        "This is disabled in the demo",
    );
  }
}
