import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import DownloadAllButton from "./DownloadAllButton";

// The admin picks how download all works. Only the prebuilt zip has anything
// to wait for. The zip built on the fly is there right away, the files mode
// fetches every file on its own, and when it is off there is no button.

const getMetaData = jest.fn();
const downloadFile = jest.fn();
const downloadFiles = jest.fn();

jest.mock("../../services/share.service", () => ({
  __esModule: true,
  default: {
    getMetaData: (...args: unknown[]) => getMetaData(...args),
    downloadFile: (...args: unknown[]) => downloadFile(...args),
    downloadFiles: (...args: unknown[]) => downloadFiles(...args),
  },
}));

const files = [
  { id: "file-one", name: "a.txt", size: "1" },
  { id: "file-two", name: "b.txt", size: "1" },
];

const renderButton = (mode: string) =>
  renderWithProviders(
    <DownloadAllButton shareId="share-id" files={files as any} />,
    { config: { "share.downloadAll": mode } },
  );

const button = () => screen.queryByRole("button", { name: "Download all" });

beforeEach(() => {
  getMetaData.mockReset();
  getMetaData.mockResolvedValue({ isZipReady: false });
  downloadFile.mockReset();
  downloadFile.mockResolvedValue(undefined);
  downloadFiles.mockReset();
});

describe("download all", () => {
  it("is not there when the admin turned it off", () => {
    renderButton("disabled");
    expect(button()).not.toBeInTheDocument();
  });

  it("waits for the prebuilt zip", async () => {
    renderButton("zip-prebuilt");
    await waitFor(() => expect(getMetaData).toHaveBeenCalled());

    fireEvent.click(button()!);

    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("downloads the prebuilt zip once it is ready", async () => {
    getMetaData.mockResolvedValue({ isZipReady: true });
    renderButton("zip-prebuilt");
    await waitFor(() => expect(getMetaData).toHaveBeenCalled());

    await waitFor(() => {
      fireEvent.click(button()!);
      expect(downloadFile).toHaveBeenCalledWith("share-id", "zip", undefined);
    });
  });

  it("downloads the zip built on the fly without waiting", () => {
    renderButton("zip-on-the-fly");

    fireEvent.click(button()!);

    expect(downloadFile).toHaveBeenCalledWith("share-id", "zip", undefined);
    expect(getMetaData).not.toHaveBeenCalled();
  });

  it("downloads every file on its own in the files mode", () => {
    renderButton("files");

    fireEvent.click(button()!);

    expect(downloadFiles).toHaveBeenCalledWith(
      "share-id",
      ["file-one", "file-two"],
      undefined,
    );
    expect(downloadFile).not.toHaveBeenCalled();
    expect(getMetaData).not.toHaveBeenCalled();
  });
});
