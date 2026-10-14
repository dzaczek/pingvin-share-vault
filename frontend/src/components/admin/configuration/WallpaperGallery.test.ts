import { wallpaperQuality } from "./WallpaperGallery";

// The badge in the gallery tells the admin whether a wallpaper will look
// sharp on a large screen before anyone sees it there.

describe("wallpaperQuality", () => {
  it("rates by what a large screen needs", () => {
    expect(wallpaperQuality(5120, 2880)).toBe("uhd");
    expect(wallpaperQuality(3840, 2160)).toBe("uhd");
    expect(wallpaperQuality(2560, 1440)).toBe("qhd");
    expect(wallpaperQuality(1920, 1080)).toBe("fhd");
    expect(wallpaperQuality(1280, 720)).toBe("small");
  });

  it("warns about portrait pictures and unknown sizes", () => {
    expect(wallpaperQuality(2160, 3840)).toBe("portrait");
    expect(wallpaperQuality()).toBe("unknown");
  });

  it("treats vector wallpapers as sharp on any screen", () => {
    expect(wallpaperQuality(undefined, undefined, true)).toBe("vector");
  });
});
