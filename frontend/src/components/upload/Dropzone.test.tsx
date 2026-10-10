import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import Dropzone from "./Dropzone";

// pulls in the markdown editor, which is esm only and irrelevant here
jest.mock("./modals/showTextEditorModal", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// The text under the drop area has to tell people what they can actually do
// on their device: tap on a phone, click or drop on a computer, and the paste
// shortcut that their keyboard really has.

const render = () =>
  renderWithProviders(
    <Dropzone isUploading={false} maxShareSize={2_000_000_000} onFilesChanged={jest.fn()} />,
  );

const userAgent = jest.spyOn(window.navigator, "userAgent", "get");

afterEach(() => userAgent.mockReset());

describe("Dropzone guidance", () => {
  it("names the size limit and the folder button for a computer", () => {
    userAgent.mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    // jsdom has no directory picker, a real browser does
    Object.defineProperty(HTMLInputElement.prototype, "webkitdirectory", {
      configurable: true,
      value: false,
    });
    try {
      render();
      expect(
        screen.getByText(
          /Click here or drag and drop.*Use the button below to upload a folder.*Ctrl\+V.*2\.0 GB/,
        ),
      ).toBeInTheDocument();
    } finally {
      delete (HTMLInputElement.prototype as any).webkitdirectory;
    }
  });

  it("leaves the folder button out where the browser has none", () => {
    userAgent.mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    render();
    expect(screen.getByText(/Click here or drag and drop/).textContent).not.toMatch(
      /folder/,
    );
  });

  it("shows the Mac paste shortcut on a Mac", () => {
    userAgent.mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)");
    render();
    expect(screen.getByText(/press ⌘\+V/)).toBeInTheDocument();
  });

  it("has a version for touch screens", () => {
    userAgent.mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)");
    render();
    expect(screen.getByText(/Tap here to select/)).toBeInTheDocument();
  });
});
