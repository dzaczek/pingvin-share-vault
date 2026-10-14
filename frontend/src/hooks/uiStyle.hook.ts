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
};

export type UiStyle = {
  // the look in effect: standard, glass or precision
  name: string;
  // null unless the look is glass
  glass: GlassSettings | null;
  // what the user picked on the account page: default or one of the looks
  preference: string;
  setPreference: (value: string) => void;
};

export const UI_STYLES = ["standard", "glass", "precision"];

export const UiStyleContext = createContext<UiStyle>({
  name: "standard",
  glass: null,
  preference: "default",
  setPreference: () => {},
});

const useUiStyle = () => useContext(UiStyleContext);

export default useUiStyle;
