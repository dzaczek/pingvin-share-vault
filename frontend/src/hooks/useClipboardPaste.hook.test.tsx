import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { withProviders } from "../test/renderWithProviders";
import useClipboardPaste from "./useClipboardPaste.hook";

// Ctrl+V on the upload page used to take only text. Files and folders copied
// in the file manager, and screenshots, now go into the upload too.

const mount = (onFiles: jest.Mock, disabled = false) =>
  renderHook(() => useClipboardPaste({ onFiles, disabled }), {
    wrapper: ({ children }: { children: ReactNode }) =>
      withProviders(<>{children}</>),
  });

const item = (file: File) => ({
  kind: "file",
  getAsFile: () => file,
  webkitGetAsEntry: () => ({ isDirectory: false, isFile: true }),
});

const paste = (
  data: { items?: any[]; text?: string },
  target: EventTarget = document.body,
) => {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      items: data.items ?? [],
      getData: (type: string) =>
        type === "text/plain" ? (data.text ?? "") : "",
    },
  });
  target.dispatchEvent(event);
  return event;
};

describe("useClipboardPaste", () => {
  it("adds pasted files", async () => {
    const onFiles = jest.fn();
    mount(onFiles);
    const file = new File(["a"], "report.pdf");

    const event = paste({ items: [item(file)] });

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(onFiles).toHaveBeenCalled());
    expect(onFiles.mock.calls[0][0][0].name).toBe("report.pdf");
    expect(onFiles.mock.calls[0][0][0].uploadingProgress).toBe(0);
  });

  it("gives every screenshot its own name", async () => {
    const onFiles = jest.fn();
    mount(onFiles);

    paste({
      items: [item(new File(["a"], "image.png", { type: "image/png" }))],
    });

    await waitFor(() => expect(onFiles).toHaveBeenCalled());
    expect(onFiles.mock.calls[0][0][0].name).toMatch(/^image_\d+\.png$/);
  });

  it("still turns pasted text into a text file", async () => {
    const onFiles = jest.fn();
    mount(onFiles);

    paste({ text: "hello, world" });

    await waitFor(() => expect(onFiles).toHaveBeenCalled());
    expect(onFiles.mock.calls[0][0][0].name).toBe("hello world.txt");
  });

  it("leaves a paste into a text field alone", () => {
    const onFiles = jest.fn();
    mount(onFiles);
    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = paste({ text: "typed" }, input);

    expect(event.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
    input.remove();
  });

  it("does nothing while disabled", () => {
    const onFiles = jest.fn();
    mount(onFiles, true);

    paste({ text: "hello" });

    expect(onFiles).not.toHaveBeenCalled();
  });
});
