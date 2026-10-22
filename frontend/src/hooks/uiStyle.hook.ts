import { createContext, useContext } from "react";

export type GlassSettings = {
  variant: "regular" | "clear";
  blur: number;
  background: "gradient" | "aurora" | "color" | "image" | "video" | "none";
  // used by the color background, empty means the primary color
  color: string;
  // the wallpaper for the image and video backgrounds
  url: string;
  tint: boolean;
  // the one panel upload and download that Precision always has
  uploadPanel: boolean;
};

export type UiStyle = {
  // the look in effect: standard, glass or precision
  name: string;
  // null unless the look is glass
  glass: GlassSettings | null;
  // what the user picked on the account page: default or one of the looks
  preference: string;
  setPreference: (value: string) => void;
  // the user's own glass choices, see applyGlassPreferences
  glassPreferences: Record<string, string>;
  setGlassPreference: (key: string, value: string) => void;
};

export const UI_STYLES = ["standard", "glass", "precision"];

export const UiStyleContext = createContext<UiStyle>({
  name: "standard",
  glass: null,
  preference: "default",
  setPreference: () => {},
  glassPreferences: {},
  setGlassPreference: () => {},
});

const useUiStyle = () => useContext(UiStyleContext);

// whether upload and download use the single panel instead of the modals
export const useUploadPanel = () => {
  const { name, glass } = useUiStyle();
  return name === "precision" || !!glass?.uploadPanel;
};

export default useUiStyle;
