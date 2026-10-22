import { Box, Group, Stack, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ComponentProps } from "react";
import { FormattedMessage } from "react-intl";
import { camelToKebab } from "../../../utils/string.util";
import AdminConfigInput from "./AdminConfigInput";

// one setting: its name and description on the left, the input on the right
const ConfigRow = (props: ComponentProps<typeof AdminConfigInput>) => {
  const isMobile = useMediaQuery("(max-width: 560px)");
  const id = `admin.config.${camelToKebab(props.configVariable.key)}`;

  return (
    <Group position="apart">
      <Stack style={{ maxWidth: isMobile ? "100%" : "40%" }} spacing={0}>
        <Title order={6}>
          <FormattedMessage id={id} />
        </Title>
        <Text sx={{ whiteSpace: "pre-line" }} color="dimmed" size="sm" mb="xs">
          <FormattedMessage id={`${id}.description`} values={{ br: <br /> }} />
        </Text>
      </Stack>
      <Stack></Stack>
      <Box style={{ width: isMobile ? "100%" : "50%" }}>
        <AdminConfigInput {...props} />
      </Box>
    </Group>
  );
};

export default ConfigRow;
