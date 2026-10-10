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

const Trigger = ({ onUpload }: { onUpload: jest.Mock }) => {
  const modals = useModals();
  return (
    <button onClick={() => showCreateUploadModal(modals, options, [], onUpload)}>
      open
    </button>
  );
};

const openForm = (onUpload: jest.Mock) => {
  render(
    <IntlProvider locale="en-US" messages={translations}>
      <ColorSchemeProvider colorScheme="light" toggleColorScheme={() => undefined}>
        <MantineProvider theme={{ colorScheme: "light" }}>
          <ModalsProvider>
            <Trigger onUpload={onUpload} />
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
