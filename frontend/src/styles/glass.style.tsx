import {
  Box,
  CSSObject,
  Global,
  keyframes,
  MantineTheme,
  MantineThemeOverride,
} from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { useEffect, useState } from "react";
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

const contentSurface = (theme: MantineTheme): CSSObject => {
  const dark = theme.colorScheme === "dark";
  return {
    background: dark ? "rgba(37, 38, 43, 0.62)" : "rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(12px) saturate(150%)",
    WebkitBackdropFilter: "blur(12px) saturate(150%)",
    borderRadius: 20,
    "&[data-with-border]": {
      border: `1px solid rgba(255, 255, 255, ${dark ? 0.08 : 0.6})`,
    },
    "@media (prefers-reduced-transparency: reduce), (prefers-contrast: more)": {
      background: dark ? theme.colors.dark[7] : theme.white,
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
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
          return { root: { borderRadius: theme.radius.xl, ...press } };
        const tinted = variant === "filled" && glass.tint;
        return {
          root: {
            borderRadius: theme.radius.xl,
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
    ActionIcon: {
      styles: (theme) => ({
        root: { borderRadius: theme.radius.xl, ...press },
      }),
    },
    Avatar: {
      styles: {
        root: { borderRadius: 999 },
        placeholder: { background: "transparent" },
      },
    },
    // cards hold content, so they get a lighter material without the glass
    // highlights, still see through enough to belong on the background
    Paper: {
      styles: (theme) => ({
        root: {
          ...contentSurface(theme),
          "&:has(> table)": { overflowX: "auto" },
        },
      }),
    },
    // quiet gray rows instead of white blocks, which look patchy on glass
    Table: {
      styles: (theme) => {
        const dark = theme.colorScheme === "dark";
        const line = `1px solid rgba(${dark ? "255, 255, 255, 0.08" : "0, 0, 0, 0.06"})`;
        return {
          root: {
            "&& thead tr th, && tbody tr td": { borderColor: "transparent" },
            "&& tbody tr td": { borderTop: line },
            "&& thead tr th": { borderBottom: line },
            "&&[data-striped] tbody tr:nth-of-type(odd)": {
              background: `rgba(118, 118, 128, ${dark ? 0.12 : 0.06})`,
            },
            "&& tbody tr:hover": {
              background: `rgba(118, 118, 128, ${dark ? 0.2 : 0.1})`,
            },
            // the share list keeps its header pinned while rows scroll under
            "&& thead": { background: "transparent" },
            "&& thead th": {
              background: dark
                ? "rgba(37, 38, 43, 0.5)"
                : "rgba(255, 255, 255, 0.45)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            },
          },
        };
      },
    },
    // the sidebar and the bar on top of the settings pages are navigation
    Navbar: {
      styles: (theme) => ({
        root: {
          ...glassSurface(theme, glass, { variant: "regular" }),
          borderRadius: 0,
          borderTop: "none",
          borderBottom: "none",
          borderLeft: "none",
        },
      }),
    },
    Header: {
      styles: (theme) => ({
        root: {
          ...glassSurface(theme, glass, { variant: "regular" }),
          borderRadius: 0,
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
        },
      }),
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
          borderRadius: theme.radius.xl,
          padding: 4,
        },
        // inset by the padding, so the thumb follows the track's curve on a
        // short control and a wide one alike
        indicator: {
          borderRadius: `calc(${theme.radius.xl} - 4px)`,
          background:
            theme.colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.2)"
              : theme.white,
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 2px 8px rgba(0, 0, 0, 0.15)",
        },
        control: {
          border: "none !important",
          borderRadius: `calc(${theme.radius.xl} - 4px)`,
        },
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
        // an iOS gray track, a white one disappears on the background
        track: {
          "input:not(:checked) + &": {
            backgroundColor: "rgba(118, 118, 128, 0.24)",
            borderColor: "transparent",
          },
        },
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

// A living wallpaper is a few frames of the same scene that fade into each
// other, day into dusk into night and back. Only opacity changes, and only
// while a fade runs, so nothing is redrawn while a frame holds.
export const LIVING: Record<string, string[]> = Object.fromEntries(
  [
    "alpine-lake",
    "alpine-flight",
    "lake-voyage",
    "nordic-balloons",
    "landwasser-passage",
  ].map((scene) => [
    `/wallpapers/${scene}.cycle`,
    ["day", "dusk", "night"].map((mode) => `/wallpapers/${scene}-${mode}.webp`),
  ]),
);
// [frames shown, seconds held], a round takes about three minutes
const CYCLE: [number, number][] = [
  [1, 40],
  [2, 25],
  [3, 45],
  [2, 20],
];
const FADE = 15;

const frameStyle = (url: string, visible: boolean) => ({
  position: "fixed" as const,
  inset: 0,
  zIndex: -1,
  pointerEvents: "none" as const,
  background: `url("${url}") center / cover no-repeat`,
  opacity: visible ? 1 : 0,
  transition: `opacity ${FADE}s ease-in-out`,
});

const Veil = () => (
  <Box
    aria-hidden
    sx={(theme) => ({
      position: "fixed",
      inset: 0,
      zIndex: -1,
      pointerEvents: "none",
      background:
        theme.colorScheme === "dark"
          ? "rgba(0, 0, 0, 0.45)"
          : "rgba(255, 255, 255, 0.4)",
    })}
  />
);

// Things that move across a living scene: aircraft, a steamer, balloons.
// Each is a small picture carried by a full size track that only changes
// its transform, so the browser moves a layer instead of redrawing the
// scene. Positions are in the 3840 x 2160 units of the scene.
type Actor = {
  src: string;
  // the picture's box around its anchor point
  box: [number, number, number, number];
  from: [number, number];
  to: [number, number];
  seconds: number;
  delay?: number;
  // back and forth instead of across and over again
  alternate?: boolean;
  scale?: number;
  opacity?: number;
  // only on at dusk and at night, like the lit windows of a train
  lights?: boolean;
  // a fixed window it shows in, [x0, y0, x1, y1], fading out over the
  // given width at both sides, so a train comes out of a tunnel and goes
  // into the next one
  window?: { clip: [number, number, number, number]; fade: number };
};

export const ACTORS: Record<string, Actor[]> = {
  "/wallpapers/alpine-flight.cycle": [
    {
      src: "/wallpapers/alpine-flight-aircraft.svg",
      box: [-980, -130, 1110, 180],
      from: [-500, 350],
      to: [4400, 500],
      seconds: 115,
      delay: -55,
    },
  ],
  "/wallpapers/lake-voyage.cycle": [
    {
      src: "/wallpapers/lake-voyage-steamer.svg",
      box: [-480, -100, 610, 135],
      from: [-700, 1680],
      to: [4480, 1650],
      seconds: 155,
      delay: -90,
    },
  ],
  "/wallpapers/landwasser-passage.cycle": [false, true].map((lights) => ({
    src: `/wallpapers/landwasser-train${lights ? "-lights" : ""}.svg`,
    box: [-20, -170, 1230, 190],
    from: [-1250, 892.5],
    to: [4040, 628],
    seconds: 100,
    delay: -44,
    lights,
    window: { clip: [525, 450, 3130, 850], fade: 91 },
  })),
  "/wallpapers/nordic-balloons.cycle": [
    {
      src: "/wallpapers/nordic-balloons-balloon.svg",
      box: [-125, -105, 250, 245],
      from: [1100, 370],
      to: [1370, 310],
      seconds: 50,
      alternate: true,
      opacity: 0.9,
    },
    {
      src: "/wallpapers/nordic-balloons-balloon.svg",
      box: [-125, -105, 250, 245],
      from: [2520, 540],
      to: [2660, 485],
      seconds: 62,
      alternate: true,
      scale: 0.62,
      opacity: 0.72,
    },
  ],
};

const at = ([x, y]: [number, number]) =>
  `translate(${(x / 3840) * 100}%, ${(y / 2160) * 100}%)`;

// dimmer at dusk and at night, like the rest of the scene
const ACTOR_LIGHT = [1, 0.85, 0.5];

const Actors = ({
  actors,
  shown,
  moving,
}: {
  actors: Actor[];
  shown: number;
  moving: boolean;
}) => (
  // the stage covers the window the way the frames do with cover
  <div
    aria-hidden
    style={{
      position: "fixed",
      left: "50%",
      top: "50%",
      width: "max(100vw, 177.78vh)",
      height: "max(100vh, 56.25vw)",
      transform: "translate(-50%, -50%)",
      overflow: "hidden",
      zIndex: -1,
      pointerEvents: "none",
    }}
  >
    {actors.map((actor, i) => {
      const scale = actor.scale ?? 1;
      const [bx, by, bw] = actor.box;
      const travel = keyframes({
        from: { transform: at(actor.from) },
        to: { transform: at(actor.to) },
      });
      const [x0, y0, x1, y1] = actor.window?.clip ?? [0, 0, 3840, 2160];
      const fade = actor.window?.fade ?? 0;
      const pct = (x: number) => `${(x / 3840) * 100}%`;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            opacity: actor.lights ? Number(shown > 1) : ACTOR_LIGHT[shown - 1],
            transition: `opacity ${FADE}s ease-in-out`,
            ...(actor.window && {
              clipPath: `inset(${(y0 / 2160) * 100}% ${100 - (x1 / 3840) * 100}% ${100 - (y1 / 2160) * 100}% ${(x0 / 3840) * 100}%)`,
              WebkitMaskImage: `linear-gradient(to right, transparent ${pct(x0)}, #000 ${pct(x0 + fade)}, #000 ${pct(x1 - fade)}, transparent ${pct(x1)})`,
              maskImage: `linear-gradient(to right, transparent ${pct(x0)}, #000 ${pct(x0 + fade)}, #000 ${pct(x1 - fade)}, transparent ${pct(x1)})`,
            }),
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              willChange: "transform",
              ...(moving
                ? {
                    animation: `${travel} ${actor.seconds}s ${actor.alternate ? "ease-in-out" : "linear"} ${actor.delay ?? 0}s infinite ${actor.alternate ? "alternate" : "normal"}`,
                  }
                : // with reduced motion it rests halfway along its way
                  {
                    transform: at([
                      (actor.from[0] + actor.to[0]) / 2,
                      (actor.from[1] + actor.to[1]) / 2,
                    ]),
                  }),
            }}
          >
            <img
              src={actor.src}
              alt=""
              style={{
                position: "absolute",
                left: `${((bx * scale) / 3840) * 100}%`,
                top: `${((by * scale) / 2160) * 100}%`,
                width: `${((bw * scale) / 3840) * 100}%`,
                opacity: actor.opacity ?? 1,
              }}
            />
          </Box>
        </div>
      );
    })}
  </div>
);

const LivingWallpaper = ({
  frames,
  actors = [],
}: {
  frames: string[];
  actors?: Actor[];
}) => {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(
      () => setStep((step + 1) % CYCLE.length),
      (CYCLE[step][1] + FADE) * 1000,
    );
    return () => clearTimeout(timer);
  }, [step, reducedMotion]);

  // with reduced motion it stays on the first frame
  const shown = reducedMotion ? 1 : CYCLE[step][0];
  return (
    <>
      {frames.map((url, i) => (
        <div key={url} aria-hidden style={frameStyle(url, i < shown)} />
      ))}
      {actors.length > 0 && (
        <Actors actors={actors} shown={shown} moving={!reducedMotion} />
      )}
      <Veil />
    </>
  );
};

// the color the glass picks up from below. Gradients are drawn in CSS, a
// wallpaper comes from the address the admin set
const backgroundLayers = (theme: MantineTheme, glass: GlassSettings) => {
  const dark = theme.colorScheme === "dark";
  const primary = theme.colors[theme.primaryColor];
  const blob = (x: string, y: string, color: string, alpha: number) =>
    `radial-gradient(circle at ${x} ${y}, ${theme.fn.rgba(color, alpha)} 0, transparent 55%)`;
  const shade = (light: number, darker: number) =>
    primary[dark ? darker : light];

  const gradient = [
    blob("15%", "10%", shade(3, 7), dark ? 0.5 : 0.45),
    blob("85%", "25%", shade(5, 8), dark ? 0.45 : 0.3),
    blob("50%", "100%", shade(2, 6), dark ? 0.35 : 0.5),
  ];
  // a photo or video under glass needs a veil, or text on the page itself
  // gets lost in a busy picture
  const veil = dark
    ? "linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45))"
    : "linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4))";
  const color = glass.color || primary[6];

  const layers = {
    none: [],
    gradient,
    aurora: [
      blob("10%", "15%", theme.colors.cyan[dark ? 8 : 3], dark ? 0.45 : 0.5),
      blob("90%", "10%", shade(4, 7), dark ? 0.55 : 0.45),
      blob("70%", "90%", theme.colors.pink[dark ? 8 : 3], dark ? 0.4 : 0.45),
      blob("20%", "85%", theme.colors.teal[dark ? 8 : 2], dark ? 0.35 : 0.4),
    ],
    // one color like the macOS solid wallpapers, kept light in light mode
    // and deep in dark mode so text on the page stays readable
    color: [
      `radial-gradient(circle at 20% 0%, ${theme.fn.rgba(theme.white, dark ? 0.06 : 0.35)} 0, transparent 60%)`,
      dark
        ? `linear-gradient(160deg, ${theme.fn.darken(color, 0.35)}, ${theme.fn.darken(color, 0.7)})`
        : `linear-gradient(160deg, ${theme.fn.lighten(color, 0.75)}, ${theme.fn.lighten(color, 0.4)})`,
    ],
    // a living wallpaper draws its frames as elements, the first one shows
    // here until they are mounted
    image: LIVING[glass.url]
      ? [veil, `url("${LIVING[glass.url][0]}") center / cover no-repeat`]
      : glass.url
        ? [veil, `url("${glass.url}") center / cover no-repeat`]
        : gradient,
    // the video itself is an element, this is what shows until it plays
    video: glass.url ? [veil, ...gradient] : gradient,
  }[glass.background];

  return [...layers, dark ? theme.colors.dark[8] : theme.colors.gray[0]].join(
    ", ",
  );
};

export const GlassGlobalStyle = ({ glass }: { glass: GlassSettings }) => {
  const reducedMotion = useReducedMotion();
  return (
    <>
      <Global
        styles={(theme) => ({
          html: {
            background: backgroundLayers(theme, glass),
            backgroundAttachment: "fixed",
            minHeight: "100%",
            // a white scrollbar track shows as a stripe down the right edge
            colorScheme: theme.colorScheme,
            scrollbarColor: `rgba(118, 118, 128, 0.5) transparent`,
          },
          "html body": { background: "transparent" },
          // the scroll box around a table becomes its card, so a wide table
          // scrolls inside a visible frame instead of being cut off
          "div:not(.mantine-Paper-root):has(> table)": {
            ...contentSurface(theme),
            padding: "4px 6px",
            overflowX: "auto",
          },
        })}
      />
      {glass.background === "video" && glass.url && (
        // muted and inline, otherwise browsers refuse to autoplay it; with
        // reduced motion it stays on its first frame
        <video
          src={glass.url}
          autoPlay={!reducedMotion}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />
      )}
      {glass.background === "video" && glass.url && <Veil />}
      {glass.background === "image" && LIVING[glass.url] && (
        <LivingWallpaper
          frames={LIVING[glass.url]}
          actors={ACTORS[glass.url]}
        />
      )}
    </>
  );
};
