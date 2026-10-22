import {
  Box,
  Center,
  ColorScheme,
  SegmentedControl,
  Select,
  Stack,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import { useColorScheme } from "@mantine/hooks";
import { useState } from "react";
import { TbDeviceLaptop, TbMoon, TbSun } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useUiStyle, { UI_STYLES } from "../../hooks/uiStyle.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import { USER_GLASS_BACKGROUNDS } from "../../utils/glassPreferences.util";
import userPreferences from "../../utils/userPreferences.util";
import {
  BUILT_IN_WALLPAPERS,
  isBuiltInWallpaper,
} from "../../utils/wallpapers.util";
import WallpaperGallery from "../admin/configuration/WallpaperGallery";

const Label = ({ id }: { id: string }) => (
  <Text size="sm" weight={500} mb={-8}>
    <FormattedMessage id={id} />
  </Text>
);

// the glass options a user may set for themselves, only while glass is on
const GlassPreferences = () => {
  const t = useTranslate();
  const { glassPreferences, setGlassPreference } = useUiStyle();
  const pref = (key: string) => glassPreferences[key] ?? "default";

  return (
    <Stack>
      <Label id="admin.config.appearance.glass-variant" />
      <SegmentedControl
        value={pref("glassVariant")}
        onChange={(value) => setGlassPreference("glassVariant", value)}
        data={["default", "regular", "clear"].map((value) => ({
          label: t(
            value === "default"
              ? "account.theme.style.default"
              : `admin.config.appearance.glass-variant.${value}`,
          ),
          value,
        }))}
      />
      <Select
        label={t("admin.config.appearance.glass-background")}
        value={pref("glassBackground")}
        onChange={(value) => {
          if (!value) return;
          setGlassPreference("glassBackground", value);
          // an image background with no picture yet would change nothing
          if (value === "image" && !isBuiltInWallpaper(pref("glassWallpaper")))
            setGlassPreference(
              "glassWallpaper",
              `/wallpapers/${BUILT_IN_WALLPAPERS[0].file}`,
            );
        }}
        data={["default", ...USER_GLASS_BACKGROUNDS].map((value) => ({
          label: t(
            value === "default"
              ? "account.theme.style.default"
              : `admin.config.appearance.glass-background.${value}`,
          ),
          value,
        }))}
      />
      {pref("glassBackground") === "image" && (
        <WallpaperGallery
          kind="image"
          builtInOnly
          value={pref("glassWallpaper")}
          onChange={(url) => setGlassPreference("glassWallpaper", url)}
        />
      )}
      <Label id="admin.config.appearance.glass-upload-panel" />
      <SegmentedControl
        value={pref("glassUploadPanel")}
        onChange={(value) => setGlassPreference("glassUploadPanel", value)}
        data={["default", "on", "off"].map((value) => ({
          label: t(
            value === "default"
              ? "account.theme.style.default"
              : `account.theme.glass.upload-panel.${value}`,
          ),
          value,
        }))}
      />
    </Stack>
  );
};

const ThemeSwitcher = () => {
  const [colorScheme, setColorScheme] = useState(
    userPreferences.get("colorScheme"),
  );
  const { toggleColorScheme } = useMantineColorScheme();
  const systemColorScheme = useColorScheme();
  const { name, preference, setPreference } = useUiStyle();
  return (
    <Stack>
      <SegmentedControl
        value={colorScheme}
        onChange={(value) => {
          userPreferences.set("colorScheme", value);
          setColorScheme(value);
          toggleColorScheme(
            value == "system" ? systemColorScheme : (value as ColorScheme),
          );
        }}
        data={[
          {
            label: (
              <Center>
                <TbMoon size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.dark" />
                </Box>
              </Center>
            ),
            value: "dark",
          },
          {
            label: (
              <Center>
                <TbSun size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.light" />
                </Box>
              </Center>
            ),
            value: "light",
          },
          {
            label: (
              <Center>
                <TbDeviceLaptop size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.system" />
                </Box>
              </Center>
            ),
            value: "system",
          },
        ]}
      />
      <Label id="account.theme.style" />
      <SegmentedControl
        value={preference}
        onChange={setPreference}
        data={["default", ...UI_STYLES].map((value) => ({
          label: <FormattedMessage id={`account.theme.style.${value}`} />,
          value,
        }))}
      />
      {name === "glass" && <GlassPreferences />}
    </Stack>
  );
};

export default ThemeSwitcher;
