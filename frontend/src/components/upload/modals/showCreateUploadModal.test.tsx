import { ColorSchemeProvider, MantineProvider } from "@mantine/core";
import { ModalsProvider, useModals } from "@mantine/modals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import translations from "../../../i18n/translations/en-US";
import showCreateUploadModal from "./showCreateUploadModal";

jest.mock("../../../services/share.service", () => ({
  __esModule: true,
  default: { isShareIdAvailable: jest.fn().mockResolvedValue(true) },
}));

// The backend refuses a description over 512 characters. Without the same
// limit in the form, the upload starts and only fails at the very end.

const options = {
  isUserSignedIn: true,
  isReverseShare: false,
  appUrl: "https://share.example.com",
  defaultAppUrl: "https://share.example.com",
  allowUnauthenticatedShares: false,
  enableEmailRecepients: false,
  enableUserRecipients: false,
  maxExpiration: { value: 0, unit: "days" },
  defaultExpiration: { value: 7, unit: "days" },
  shareIdLength: 8,
  simplified: true,
} as any;

const Trigger = ({
  onUpload,
  simplified = true,
}: {
  onUpload: jest.Mock;
  simplified?: boolean;
}) => {
  const modals = useModals();
  return (
    <button
      onClick={() =>
        showCreateUploadModal(modals, { ...options, simplified }, [], onUpload)
      }
    >
      open
    </button>
  );
};

const openForm = (onUpload: jest.Mock, simplified = true) => {
  render(
    <IntlProvider locale="en-US" messages={translations}>
      <ColorSchemeProvider colorScheme="light" toggleColorScheme={() => undefined}>
        <MantineProvider theme={{ colorScheme: "light" }}>
          <ModalsProvider>
            <Trigger onUpload={onUpload} simplified={simplified} />
          </ModalsProvider>
        </MantineProvider>
      </ColorSchemeProvider>
    </IntlProvider>,
  );
  act(() => fireEvent.click(screen.getByText("open")));
};

const typeDescription = (text: string) =>
  fireEvent.change(
    screen.getByPlaceholderText(
      translations["upload.modal.accordion.name-and-description.description.placeholder"],
    ),
    { target: { value: text } },
  );

describe("create upload modal, description", () => {
  it("refuses a description over 512 characters", async () => {
    const onUpload = jest.fn();
    openForm(onUpload);

    typeDescription("x".repeat(513));
    fireEvent.click(screen.getByText("Share"));

    expect(
      await screen.findByText("Must be at most 512 characters"),
    ).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("accepts a description of exactly 512 characters", async () => {
    const onUpload = jest.fn();
    openForm(onUpload);

    typeDescription("x".repeat(512));
    fireEvent.click(screen.getByText("Share"));

    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(onUpload.mock.calls[0][0].description).toHaveLength(512);
  });
});

// The server may run in UTC. A relative "7-days" counted there comes out an
// hour off the date this form shows when a clock change falls in between, so
// the form sends the very date it showed.
describe("create upload modal, expiration", () => {
  it("sends the date it shows, counted in the browser's calendar", async () => {
    const onUpload = jest.fn();
    openForm(onUpload, false);

    const expected = new Date();
    expected.setDate(expected.getDate() + 7);
    fireEvent.click(screen.getByText("Share"));

    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    const sent = onUpload.mock.calls[0][0].expiration;
    expect(sent).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(
      Math.abs(new Date(sent).getTime() - expected.getTime()),
    ).toBeLessThan(60_000);
  });
});
