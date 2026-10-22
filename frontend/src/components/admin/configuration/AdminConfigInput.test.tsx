import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import translations from "../../../i18n/translations/en-US";
import { AdminConfig } from "../../../types/config.type";
import AdminConfigInput from "./AdminConfigInput";

// Mail settings do nothing without smtp, so their switch stays greyed out
// until it is on. A setting locked by config.yaml stays greyed out either way.

const config = (key: string, value: string, allowEdit = true) =>
  ({ key, value, type: "boolean", allowEdit }) as AdminConfig;

const switchFor = (key: string, smtp: string, allowEdit = true) => {
  const { container } = render(
    <IntlProvider locale="en-US" messages={translations}>
      <MantineProvider>
        <AdminConfigInput
          configVariable={config(key, "false", allowEdit)}
          updateConfigVariable={() => undefined}
          optionalConfigVariables={[config("smtp.enabled", smtp)]}
        />
      </MantineProvider>
    </IntlProvider>,
  );
  return container.querySelector("input[type=checkbox]") as HTMLInputElement;
};

const MAIL_SETTINGS = [
  "share.enableShareEmailRecipients",
  "share.enableShareDownloadNotifications",
  "share.enableUserRecipients",
  "security.enableEmailVerification",
];

describe.each(MAIL_SETTINGS)("the %s switch", (key) => {
  it("is greyed out while smtp is off", () => {
    expect(switchFor(key, "false")).toBeDisabled();
  });

  it("can be changed once smtp is on", () => {
    expect(switchFor(key, "true")).toBeEnabled();
  });

  it("stays greyed out when config.yaml sets it", () => {
    expect(switchFor(key, "true", false)).toBeDisabled();
  });
});

it("leaves a switch that has nothing to do with mail alone", () => {
  expect(switchFor("share.autoOpenShareModal", "false")).toBeEnabled();
});
