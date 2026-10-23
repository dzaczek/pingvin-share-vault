import { fireEvent, screen } from "@testing-library/react";
import { UiStyleContext } from "../../hooks/uiStyle.hook";
import { renderWithProviders } from "../../test/renderWithProviders";
import Dropzone from "./Dropzone";

jest.mock("./modals/showTextEditorModal", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// In the glass style files and folders get a card each, and the folder card
// only shows up where the browser can pick a folder at all.

const glass = {
  variant: "regular",
  blur: 20,
  background: "gradient",
  color: "",
  url: "",
  tint: true,
  uploadPanel: false,
} as const;

const render = (withGlass = true, uploadPanel = false) =>
  renderWithProviders(
    <UiStyleContext.Provider
      value={{
        name: withGlass ? "glass" : "standard",
        glass: withGlass ? { ...glass, uploadPanel } : null,
        preference: "default",
        setPreference: jest.fn(),
        glassPreferences: {},
        setGlassPreference: jest.fn(),
      }}
    >
      <Dropzone
        isUploading={false}
        maxShareSize={2_000_000_000}
        onFilesChanged={jest.fn()}
      />
    </UiStyleContext.Provider>,
  );

const withFolderPicker = (run: () => void) => {
  Object.defineProperty(HTMLInputElement.prototype, "webkitdirectory", {
    configurable: true,
    value: false,
  });
  try {
    run();
  } finally {
    delete (HTMLInputElement.prototype as any).webkitdirectory;
  }
};

describe("Dropzone in the glass style", () => {
  it("shows a card for files and one for a folder", () =>
    withFolderPicker(() => {
      render();
      expect(screen.getByText("Files")).toBeInTheDocument();
      expect(screen.getByText("Folder")).toBeInTheDocument();
      // once worded for touch screens, once for the rest
      expect(
        screen.getAllByText(/Maximum total upload size: 2\.0 GB/),
      ).toHaveLength(2);
    }));

  it("leaves the folder card out where the browser has no folder picker", () => {
    render();
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.queryByText("Folder")).not.toBeInTheDocument();
  });

  it("keeps the single drop area in the standard style", () =>
    withFolderPicker(() => {
      render(false);
      expect(screen.queryByText("Files")).not.toBeInTheDocument();
      expect(screen.getByText("Upload files")).toBeInTheDocument();
    }));
});

// Mantine puts the dropzone's own click and key handlers after ours, so the
// folder tile has to catch them first or nothing opens.
describe("the folder tile", () => {
  const picked = () => {
    const click = jest
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    return () => {
      const inputs = click.mock.contexts as HTMLInputElement[];
      click.mockRestore();
      return inputs.map((input) => input.hasAttribute("webkitdirectory"));
    };
  };

  it.each([
    ["the glass cards", false, "Folder"],
    ["the upload panel", true, "Add a folder"],
  ])("opens the folder picker in %s", (_, uploadPanel, label) =>
    withFolderPicker(() => {
      render(true, uploadPanel);
      const tile = screen.getByText(label).closest('[role="presentation"]')!;

      let done = picked();
      fireEvent.click(tile);
      expect(done()).toEqual([true]);

      done = picked();
      fireEvent.keyDown(tile, { key: "Enter" });
      expect(done()).toEqual([true]);
    }),
  );
});
