import { GlassSettings } from "../hooks/uiStyle.hook";
import { applyGlassPreferences } from "./glassPreferences.util";

const admin: GlassSettings = {
  variant: "regular",
  blur: 20,
  background: "video",
  color: "",
  url: "/api/wallpapers/admin.mp4",
  tint: true,
  uploadPanel: false,
};

describe("applyGlassPreferences", () => {
  it("keeps the admin settings while everything is default", () => {
    expect(applyGlassPreferences(admin, {})).toEqual(admin);
    expect(
      applyGlassPreferences(admin, {
        glassVariant: "default",
        glassBackground: "default",
        glassUploadPanel: "default",
      }),
    ).toEqual(admin);
  });

  it("lets the user pick the variant, the panel and a plain background", () => {
    expect(
      applyGlassPreferences(admin, {
        glassVariant: "clear",
        glassUploadPanel: "on",
        glassBackground: "aurora",
      }),
    ).toMatchObject({
      variant: "clear",
      uploadPanel: true,
      background: "aurora",
    });
  });

  it("takes a built in wallpaper only", () => {
    expect(
      applyGlassPreferences(admin, {
        glassBackground: "image",
        glassWallpaper: "/wallpapers/dunes.svg",
      }),
    ).toMatchObject({ background: "image", url: "/wallpapers/dunes.svg" });

    // anything else in local storage is ignored, a user brings no files
    for (const glassWallpaper of [
      "https://example.invalid/x.jpg",
      "/api/wallpapers/admin.webp",
      "",
    ])
      expect(
        applyGlassPreferences(admin, {
          glassBackground: "image",
          glassWallpaper,
        }),
      ).toEqual(admin);
  });

  it("ignores values it does not know", () => {
    expect(
      applyGlassPreferences(admin, {
        glassVariant: "frosted",
        glassBackground: "video",
        glassUploadPanel: "maybe",
      }),
    ).toEqual(admin);
  });
});
