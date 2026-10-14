import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { DEMO_MODE } from "src/constants";

// The look and the download mode are what people come to the demo to try.
// Changing them only alters how the demo looks until the next reset, so a
// settings save made of nothing else goes through.
export const EDITABLE_IN_DEMO = [
  "appearance.uiStyle",
  "appearance.glassVariant",
  "appearance.glassBlur",
  "appearance.glassBackground",
  "appearance.glassBackgroundColor",
  "appearance.glassTint",
  "appearance.themePrimaryColor",
  "appearance.themePrimaryColorOverride",
  "appearance.themeRadius",
  "appearance.themeColorScheme",
  "appearance.uploadProgressStyle",
  "share.downloadAll",
];

// a wallpaper from anywhere would show a stranger's picture to the next
// visitor, the ones that ship with the app are fine
const isBuiltInWallpaper = (value: unknown) =>
  value === "" || /^\/wallpapers\/[a-z0-9-]+\.svg$/.test(`${value}`);

const editableInDemo = (setting?: { key?: string; value?: unknown }) =>
  EDITABLE_IN_DEMO.includes(setting?.key) ||
  (setting?.key === "appearance.glassBackgroundUrl" &&
    isBuiltInWallpaper(setting.value));

// In the public demo anyone can be the admin, so nobody may change what the
// next visitor sees or lock them out. Does nothing on a normal instance.
@Injectable()
export class DemoModeGuard implements CanActivate {
  canActivate(context?: ExecutionContext) {
    if (!DEMO_MODE) return true;
    const body = context?.switchToHttp().getRequest().body;
    if (Array.isArray(body) && body.length > 0 && body.every(editableInDemo))
      return true;
    throw new ForbiddenException(
      I18nContext.current()?.t("config.disabledInDemo") ??
        "This is disabled in the demo",
    );
  }
}
