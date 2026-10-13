import {
  CSSObject,
  Global,
  MantineTheme,
  MantineThemeOverride,
} from "@mantine/core";
import { GlassSettings } from "../hooks/uiStyle.hook";

// The glass look follows Apple's Liquid Glass guidance: glass is for the
// layer of controls and navigation that floats above the content, never for
// the content itself, and it is used sparingly. Text heavy surfaces like
// menus and modals always get the regular variant, color goes only on the
// main action, and every surface turns solid when the system asks for less
// transparency or more contrast, or when the browser cannot blur.

const solid = (theme: MantineTheme, color?: string) =>
  color ?? (theme.colorScheme === "dark" ? theme.colors.dark[6] : theme.white);

export const glassSurface = (
  theme: MantineTheme,
  glass: GlassSettings,
  { variant = glass.variant, color }: { variant?: string; color?: string } = {},
): CSSObject => {
  const dark = theme.colorScheme === "dark";
  const alpha = variant === "clear" ? (dark ? 0.15 : 0.2) : dark ? 0.55 : 0.6;
  const filter = `blur(${glass.blur}px) saturate(${variant === "clear" ? 200 : 180}%)`;

  return {
    background: color
      ? theme.fn.rgba(color, 0.78)
      : dark
        ? `rgba(28, 28, 34, ${alpha})`
        : `rgba(255, 255, 255, ${alpha})`,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    border: `1px solid rgba(255, 255, 255, ${dark ? 0.14 : 0.7})`,
    boxShadow: [
      `inset 0 1px 0 rgba(255, 255, 255, ${dark ? 0.18 : 0.8})`,
      `inset 0 -1px 0 rgba(0, 0, 0, ${dark ? 0.3 : 0.06})`,
      `0 8px 32px rgba(0, 0, 0, ${dark ? 0.45 : 0.12})`,
    ].join(", "),

    "@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))":
      { background: solid(theme, color) },
    "@media (prefers-reduced-transparency: reduce)": {
      background: solid(theme, color),
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
    },
    "@media (prefers-contrast: more)": {
      background: solid(theme, color),
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
      border: `1px solid ${dark ? theme.colors.dark[0] : theme.colors.gray[8]}`,
    },
  };
};

// a short squeeze on press, the liquid part, left out for reduced motion
const press: CSSObject = {
  transition: "transform 120ms ease, filter 120ms ease",
  "&:not([data-disabled]):active": { transform: "scale(0.97)" },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "&:not([data-disabled]):active": { transform: "none" },
  },
};

export const glassTheme = (glass: GlassSettings): MantineThemeOverride => ({
  components: {
    Button: {
      styles: (theme, params: { color?: string }, { variant }) => {
        if (!["filled", "default", "light", "outline"].includes(variant ?? ""))
          return { root: { borderRadius: 999, ...press } };
        const tinted = variant === "filled" && glass.tint;
        return {
          root: {
            borderRadius: 999,
            ...press,
            "&:not([data-disabled])": {
              ...glassSurface(theme, glass, {
                color: tinted
                  ? theme.fn.variant({ variant: "filled", color: params.color })
                      .background
                  : undefined,
              }),
              color: tinted
                ? theme.white
                : theme.fn.variant({ variant: "light", color: params.color })
                    .color,
              "&:hover": { filter: "brightness(1.08)" },
            },
          },
        };
      },
    },
    ActionIcon: { styles: { root: { borderRadius: 999, ...press } } },
    Avatar: {
      styles: {
        root: { borderRadius: 999 },
        placeholder: { background: "transparent" },
      },
    },
    // the footer sits on the background like the content does
    Footer: {
      styles: { root: { background: "transparent", borderTop: "none" } },
    },
    SegmentedControl: {
      styles: (theme) => ({
        // a gray track like Apple's fill color, so the white thumb still
        // shows up on a white card
        root: {
          ...glassSurface(theme, glass),
          background: "rgba(118, 118, 128, 0.16)",
          borderRadius: 999,
          padding: 4,
        },
        indicator: {
          borderRadius: 999,
          background:
            theme.colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.2)"
              : theme.white,
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 2px 8px rgba(0, 0, 0, 0.15)",
        },
        control: { border: "none !important" },
      }),
    },
    Menu: {
      styles: (theme) => ({
        dropdown: {
          ...glassSurface(theme, glass, { variant: "regular" }),
          borderRadius: 16,
          padding: 6,
        },
        item: { borderRadius: 10 },
      }),
    },
    Popover: {
      styles: (theme) => ({
        dropdown: {
          ...glassSurface(theme, glass, { variant: "regular" }),
          borderRadius: 16,
        },
      }),
    },
    Select: {
      styles: (theme) => ({
        dropdown: {
          ...glassSurface(theme, glass, { variant: "regular" }),
          borderRadius: 14,
        },
        item: { borderRadius: 8 },
      }),
    },
    Modal: {
      styles: (theme) => ({
        content: {
          ...glassSurface(theme, glass, { variant: "regular" }),
          borderRadius: 24,
        },
        header: { background: "transparent" },
      }),
    },
    Notification: {
      styles: (theme) => ({
        root: {
          ...glassSurface(theme, glass, { variant: "regular" }),
          borderRadius: 18,
        },
      }),
    },
    Switch: {
      styles: {
        thumb: {
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 2px 6px rgba(0, 0, 0, 0.25)",
        },
      },
    },
  },
});

type Components = NonNullable<MantineThemeOverride["components"]>;

// both sets can style the same component, Modal for one, so the parts they
// style are joined instead of one set replacing the other
export const joinComponents = (
  base: Components = {},
  extra: Components = {},
) => {
  const joined: Components = { ...base };
  for (const [name, override] of Object.entries(extra)) {
    const first = base[name];
    joined[name] = !first
      ? override
      : {
          ...first,
          ...override,
          styles: (...args: any[]) => {
            const resolve = (styles: any) =>
              (typeof styles === "function" ? styles(...args) : styles) ?? {};
            const a = resolve(first.styles);
            const b = resolve(override.styles);
            return Object.fromEntries(
              [...new Set([...Object.keys(a), ...Object.keys(b)])].map(
                (part) => [part, { ...a[part], ...b[part] }],
              ),
            );
          },
        };
  }
  return joined;
};

// the color the glass picks up from below, drawn in CSS so nothing is loaded
const backgroundLayers = (theme: MantineTheme, glass: GlassSettings) => {
  const dark = theme.colorScheme === "dark";
  const primary = theme.colors[theme.primaryColor];
  const blob = (x: string, y: string, color: string, alpha: number) =>
    `radial-gradient(circle at ${x} ${y}, ${theme.fn.rgba(color, alpha)} 0, transparent 55%)`;
  const shade = (light: number, darker: number) =>
    primary[dark ? darker : light];

  const layers = {
    none: [],
    gradient: [
      blob("15%", "10%", shade(3, 7), dark ? 0.5 : 0.45),
      blob("85%", "25%", shade(5, 8), dark ? 0.45 : 0.3),
      blob("50%", "100%", shade(2, 6), dark ? 0.35 : 0.5),
    ],
    aurora: [
      blob("10%", "15%", theme.colors.cyan[dark ? 8 : 3], dark ? 0.45 : 0.5),
      blob("90%", "10%", shade(4, 7), dark ? 0.55 : 0.45),
      blob("70%", "90%", theme.colors.pink[dark ? 8 : 3], dark ? 0.4 : 0.45),
      blob("20%", "85%", theme.colors.teal[dark ? 8 : 2], dark ? 0.35 : 0.4),
    ],
  }[glass.background];

  return [...layers, dark ? theme.colors.dark[8] : theme.colors.gray[0]].join(
    ", ",
  );
};

export const GlassGlobalStyle = ({ glass }: { glass: GlassSettings }) => (
  <Global
    styles={(theme) => ({
      "html body": {
        background: backgroundLayers(theme, glass),
        backgroundAttachment: "fixed",
        minHeight: "100vh",
      },
    })}
  />
);
