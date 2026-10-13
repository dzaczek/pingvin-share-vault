import { createContext, useContext } from "react";

export type GlassSettings = {
  variant: "regular" | "clear";
  blur: number;
  background: "gradient" | "aurora" | "none";
  tint: boolean;
};

export type UiStyle = {
  // null means the standard look
  glass: GlassSettings | null;
  // what the user picked on the account page: default, standard or glass
  preference: string;
  setPreference: (value: string) => void;
};

export const UiStyleContext = createContext<UiStyle>({
  glass: null,
  preference: "default",
  setPreference: () => {},
});

const useUiStyle = () => useContext(UiStyleContext);

export default useUiStyle;
