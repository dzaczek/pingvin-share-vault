import {
  CSSObject,
  Global,
  MantineTheme,
  MantineThemeOverride,
} from "@mantine/core";

// Precision is a calm, technical look for people who scan a lot of data:
// crisp 1px borders instead of shadows, small radii, dense tables, one red
// accent and monospace for anything that is an identifier. White text on the
// proposed #e63329 is only 4.3:1, so filled buttons use the darker #c52620
// (5.7:1) and #e63329 stays for accents.

const red = [
  "#fff0ef",
  "#ffdad7",
  "#ffb3ad",
  "#ff8a82",
  "#ff6257",
  "#e63329",
  "#c52620",
  "#a31f1a",
  "#821914",
  "#61120f",
] as const;

// Mantine reads text from dark[0], dimmed text from dark[2], borders from
// dark[4], inputs from dark[6] and the page from dark[7]
const dark = [
  "#f0f4f7",
  "#b0bcc7",
  "#8e9ba7",
  "#6b7885",
  "#36434f",
  "#2c3843",
  "#222d38",
  "#19212a",
  "#141a21",
  "#10151b",
] as const;

export const precisionTokens = (theme: Pick<MantineTheme, "colorScheme">) =>
  theme.colorScheme === "dark"
    ? {
        bg: "#10151b",
        surface: "#19212a",
        raised: "#222d38",
        text: "#f0f4f7",
        muted: "#b0bcc7",
        border: "#36434f",
        soft: "#3d2426",
        accent: "#ff6257",
        info: "#70b8f0",
        zebra: "rgba(255, 255, 255, 0.025)",
        hover: "rgba(255, 255, 255, 0.05)",
      }
    : {
        bg: "#f5f7f9",
        surface: "#ffffff",
        raised: "#ffffff",
        text: "#17212b",
        muted: "#5c6975",
        border: "#dce2e7",
        soft: "#fff0ef",
        accent: "#e63329",
        info: "#1768a6",
        zebra: "#f9fafb",
        hover: "#f1f4f6",
      };

const motion: CSSObject = {
  transition: "background-color 150ms ease, border-color 150ms ease",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
};

const card = (theme: MantineTheme): CSSObject => {
  const t = precisionTokens(theme);
  return {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    boxShadow: "none",
  };
};

const fontFamily =
  'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const precisionTheme: MantineThemeOverride = {
  colors: { precision: [...red], dark: [...dark] },
  primaryColor: "precision",
  primaryShade: { light: 6, dark: 6 },
  defaultRadius: 6,
  fontFamily,
  fontFamilyMonospace:
    '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  headings: {
    fontFamily,
    fontWeight: 650,
    sizes: {
      h1: { fontSize: "1.625rem", lineHeight: 1.2 },
      h2: { fontSize: "1.375rem", lineHeight: 1.25 },
      h3: { fontSize: "1.125rem", lineHeight: 1.3 },
      h4: { fontSize: "1rem", lineHeight: 1.35 },
    },
  },
  focusRingStyles: {
    styles: (theme) => ({
      outline: `2px solid ${precisionTokens(theme).accent}`,
      outlineOffset: 2,
    }),
    inputStyles: (theme) => ({
      outline: "none",
      borderColor: precisionTokens(theme).accent,
      boxShadow: `0 0 0 1px ${precisionTokens(theme).accent}`,
    }),
  },
  components: {
    Button: {
      styles: (theme, _params, { variant }) => ({
        root: {
          borderRadius: 6,
          fontWeight: 600,
          ...motion,
          ...(variant === "default" && {
            background: precisionTokens(theme).surface,
            borderColor: precisionTokens(theme).border,
            color: precisionTokens(theme).text,
          }),
        },
      }),
    },
    // red is the accent and the color of failures, so links are blue
    Anchor: {
      styles: (theme) => ({ root: { color: precisionTokens(theme).info } }),
    },
    Header: {
      styles: (theme) => ({
        root: {
          background: precisionTokens(theme).surface,
          borderColor: precisionTokens(theme).border,
        },
      }),
    },
    Navbar: {
      styles: (theme) => ({
        root: {
          background: precisionTokens(theme).surface,
          borderColor: precisionTokens(theme).border,
        },
      }),
    },
    ActionIcon: { styles: { root: { borderRadius: 6, ...motion } } },
    Paper: {
      styles: (theme) => ({
        root: {
          ...card(theme),
          "&:has(> table)": { overflowX: "auto" },
        },
      }),
    },
    Card: { styles: (theme) => ({ root: card(theme) }) },
    Modal: {
      styles: (theme) => ({
        content: {
          background: precisionTokens(theme).raised,
          border: `1px solid ${precisionTokens(theme).border}`,
          borderRadius: 10,
        },
        header: { background: precisionTokens(theme).raised },
      }),
    },
    Menu: {
      styles: (theme) => ({
        dropdown: {
          background: precisionTokens(theme).raised,
          border: `1px solid ${precisionTokens(theme).border}`,
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
        },
        item: { borderRadius: 4 },
      }),
    },
    Popover: {
      styles: (theme) => ({
        dropdown: {
          background: precisionTokens(theme).raised,
          borderColor: precisionTokens(theme).border,
          borderRadius: 8,
        },
      }),
    },
    Badge: {
      styles: {
        root: { borderRadius: 4, textTransform: "none", fontWeight: 600 },
      },
    },
    Notification: {
      styles: (theme) => ({
        root: {
          ...card(theme),
          background: precisionTokens(theme).raised,
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
        },
      }),
    },
    Tabs: {
      styles: (theme) => ({
        tab: {
          fontWeight: 550,
          "&[data-active]": { borderColor: precisionTokens(theme).accent },
        },
      }),
    },
    Code: {
      styles: (theme) => ({
        root: {
          fontSize: 12,
          background: precisionTokens(theme).hover,
          borderRadius: 4,
        },
      }),
    },
    // dense rows, a quiet zebra and a header that stays on top
    Table: {
      styles: (theme) => {
        const t = precisionTokens(theme);
        return {
          root: {
            fontSize: 13,
            "&& thead tr th": {
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: t.surface,
              color: t.muted,
              fontSize: 12,
              fontWeight: 600,
              borderBottom: `1px solid ${t.border}`,
            },
            "&& tbody tr td": {
              borderTop: `1px solid ${t.border}`,
              paddingTop: 9,
              paddingBottom: 9,
            },
            "&& tbody tr:nth-of-type(even)": { background: t.zebra },
            "&& tbody tr:hover": { background: t.hover },
          },
        };
      },
    },
  },
};

export const PrecisionGlobalStyle = () => (
  <Global
    styles={(theme) => {
      const t = precisionTokens(theme);
      return {
        html: {
          colorScheme: theme.colorScheme,
          scrollbarColor: `${t.border} transparent`,
        },
        "html body": { background: t.bg, color: t.text },
        // identifiers like IPs, visitor ids and share ids
        "[data-mono]": {
          fontFamily: theme.fontFamilyMonospace,
          fontSize: 12.5,
        },
        // a table in a scroll box sits in a bordered card, so a wide table
        // scrolls inside a frame instead of running off the page
        "div:not(.mantine-Paper-root):has(> table)": {
          ...card(theme),
          overflowX: "auto",
        },
      };
    }}
  />
);
