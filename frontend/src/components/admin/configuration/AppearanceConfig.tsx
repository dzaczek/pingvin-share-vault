import { Stack, Tabs, Text } from "@mantine/core";
import { Dispatch, SetStateAction, useState } from "react";
import { FormattedMessage } from "react-intl";
import { UI_STYLES } from "../../../hooks/uiStyle.hook";
import { AdminConfig, UpdateConfig } from "../../../types/config.type";
import ConfigRow from "./ConfigRow";
import LogoConfigInput from "./LogoConfigInput";

// anything not named here lands on the general tab, so a new setting shows
// up somewhere rather than nowhere
const tabOf = (key: string) =>
  key === "appearance.customCss"
    ? "advanced"
    : key === "appearance.uiStyle" || key.startsWith("appearance.glass")
      ? "style"
      : "general";

const AppearanceConfig = ({
  configVariables,
  updatedConfigVariables,
  updateConfigVariable,
  getEffectiveConfigValue,
  logo,
  setLogo,
  darkLogo,
  setDarkLogo,
}: {
  configVariables: AdminConfig[];
  updatedConfigVariables: UpdateConfig[];
  updateConfigVariable: (variable: UpdateConfig) => void;
  getEffectiveConfigValue: (key: string) => string;
  logo: File | null;
  setLogo: Dispatch<SetStateAction<File | null>>;
  darkLogo: File | null;
  setDarkLogo: Dispatch<SetStateAction<File | null>>;
}) => {
  const uiStyle = getEffectiveConfigValue("appearance.uiStyle");
  const glassBackground = getEffectiveConfigValue("appearance.glassBackground");

  // follows the default style as it is picked, the others stay reachable
  // because users can choose them on their account page. A tab opened by hand
  // only counts while the default it was opened under is still the one
  const [opened, setOpened] = useState<{ under: string; tab: string }>();
  const styleTab = opened?.under === uiStyle ? opened.tab : uiStyle;

  const hidden = (key: string) =>
    (key === "appearance.themePrimaryColorOverride" &&
      getEffectiveConfigValue("appearance.themePrimaryColor") !== "custom") ||
    (key === "appearance.glassBackgroundColor" &&
      glassBackground !== "color") ||
    (key === "appearance.glassBackgroundUrl" &&
      !["image", "video"].includes(glassBackground));

  const rows = (filter: (key: string) => boolean) =>
    configVariables
      .filter(({ key }) => filter(key) && !hidden(key))
      .map((configVariable) => (
        <ConfigRow
          key={configVariable.key}
          configVariable={configVariable}
          updateConfigVariable={updateConfigVariable}
          allConfigVariables={configVariables}
          updatedConfigVariables={updatedConfigVariables}
        />
      ));

  return (
    <Tabs defaultValue="general" keepMounted>
      <Tabs.List mb="md">
        {["general", "style", "brand", "advanced"].map((tab) => (
          <Tabs.Tab key={tab} value={tab}>
            <FormattedMessage id={`admin.config.appearance.tab.${tab}`} />
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="general">
        <Stack>{rows((key) => tabOf(key) === "general")}</Stack>
      </Tabs.Panel>

      <Tabs.Panel value="style">
        <Stack>
          {rows((key) => key === "appearance.uiStyle")}
          <Tabs
            value={styleTab}
            onTabChange={(tab) => tab && setOpened({ under: uiStyle, tab })}
            variant="pills"
            keepMounted
          >
            <Tabs.List mb="md">
              {UI_STYLES.map((style) => (
                <Tabs.Tab key={style} value={style}>
                  <FormattedMessage id={`account.theme.style.${style}`} />
                  {style === uiStyle && (
                    <>
                      {" · "}
                      <FormattedMessage id="admin.config.appearance.tab.default" />
                    </>
                  )}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel value="standard">
              <Text color="dimmed" size="sm">
                <FormattedMessage id="admin.config.appearance.tab.standard.empty" />
              </Text>
            </Tabs.Panel>
            <Tabs.Panel value="glass">
              <Stack>{rows((key) => key.startsWith("appearance.glass"))}</Stack>
            </Tabs.Panel>
            <Tabs.Panel value="precision">
              <Text color="dimmed" size="sm">
                <FormattedMessage id="admin.config.appearance.tab.precision.empty" />
              </Text>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="brand">
        <Stack>
          <LogoConfigInput
            logo={logo}
            setLogo={setLogo}
            darkLogo={darkLogo}
            setDarkLogo={setDarkLogo}
          />
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="advanced">
        <Stack>{rows((key) => tabOf(key) === "advanced")}</Stack>
      </Tabs.Panel>
    </Tabs>
  );
};

export default AppearanceConfig;
