import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "Pingvin Share Vault",
  tagline:
    "Pingvin Share Vault is a self-hosted file sharing platform and an alternative for WeTransfer.",
  favicon: "img/pingvinshare.svg",

  url: "https://dzaczek.github.io",
  baseUrl: "/pingvin-share-vault/",
  organizationName: "dzaczek",
  projectName: "pingvin-share-vault",

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/dzaczek/pingvin-share-vault/edit/main/docs",
          lastVersion: "v1",
          versions: {
            v1: {
              label: "v1.x.x",
              banner: "none",
            },
            current: {
              label: "v2.x.x",
              path: "v2",
              banner: "unreleased",
            },
          },
        },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/pingvinshare.svg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Pingvin Share Vault",
      logo: {
        alt: "Pingvin Share Logo",
        src: "img/pingvinshare.svg",
      },
      items: [
        {
          type: "docsVersionDropdown",
          position: "right",
        },
        {
          href: "https://github.com/dzaczek/pingvin-share-vault",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
