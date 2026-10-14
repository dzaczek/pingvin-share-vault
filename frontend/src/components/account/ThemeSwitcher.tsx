import {
  Box,
  Center,
  ColorScheme,
  SegmentedControl,
  Stack,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import { useColorScheme } from "@mantine/hooks";
import { useState } from "react";
import { TbDeviceLaptop, TbMoon, TbSun } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useUiStyle, { UI_STYLES } from "../../hooks/uiStyle.hook";
import userPreferences from "../../utils/userPreferences.util";

const ThemeSwitcher = () => {
  const [colorScheme, setColorScheme] = useState(
    userPreferences.get("colorScheme"),
  );
  const { toggleColorScheme } = useMantineColorScheme();
  const systemColorScheme = useColorScheme();
  const { preference, setPreference } = useUiStyle();
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
      <Text size="sm" weight={500} mb={-8}>
        <FormattedMessage id="account.theme.style" />
      </Text>
      <SegmentedControl
        value={preference}
        onChange={setPreference}
        data={["default", ...UI_STYLES].map((value) => ({
          label: <FormattedMessage id={`account.theme.style.${value}`} />,
          value,
        }))}
      />
    </Stack>
  );
};

export default ThemeSwitcher;
