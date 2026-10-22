import { GlassSettings } from "../hooks/uiStyle.hook";
import { isBuiltInWallpaper } from "./wallpapers.util";

export const GLASS_PREFERENCE_KEYS = [
  "glassVariant",
  "glassBackground",
  "glassWallpaper",
  "glassUploadPanel",
];

// what a user may pick for themselves, nothing that needs a file of their own
export const USER_GLASS_BACKGROUNDS = ["gradient", "aurora", "image", "none"];

// The account page choices on top of the admin glass settings. "default" or
// anything unknown leaves the admin value alone.
export const applyGlassPreferences = (
  admin: GlassSettings,
  prefs: Record<string, string | undefined>,
): GlassSettings => {
  const glass = { ...admin };

  if (prefs.glassVariant === "regular" || prefs.glassVariant === "clear")
    glass.variant = prefs.glassVariant;

  if (prefs.glassUploadPanel === "on") glass.uploadPanel = true;
  if (prefs.glassUploadPanel === "off") glass.uploadPanel = false;

  const background = prefs.glassBackground ?? "";
  if (background === "image") {
    if (isBuiltInWallpaper(prefs.glassWallpaper ?? "")) {
      glass.background = "image";
      glass.url = prefs.glassWallpaper!;
    }
  } else if (USER_GLASS_BACKGROUNDS.includes(background)) {
    glass.background = background as GlassSettings["background"];
  }

  return glass;
};
