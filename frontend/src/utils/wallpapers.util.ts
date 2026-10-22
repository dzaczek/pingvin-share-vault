// the Alpine lake is a living wallpaper: 4K frames of day, dusk and night
// that fade into each other, see LIVING in the glass style
export const BUILT_IN_WALLPAPERS: {
  file: string;
  preview?: string;
  width?: number;
  height?: number;
}[] = [
  ...[
    "alpine-lake",
    "alpine-flight",
    "lake-voyage",
    "nordic-balloons",
    "landwasser-passage",
  ].map((scene) => ({
    file: `${scene}.cycle`,
    preview: `${scene}-day.webp`,
    width: 3840,
    height: 2160,
  })),
  { file: "orbital-quiet.webp", width: 3840, height: 2160 },
  { file: "dunes.svg" },
  { file: "lagoon.svg" },
  { file: "meadow.svg" },
  { file: "midnight.svg" },
];

export const isBuiltInWallpaper = (url: string) =>
  BUILT_IN_WALLPAPERS.some(({ file }) => url === `/wallpapers/${file}`);
