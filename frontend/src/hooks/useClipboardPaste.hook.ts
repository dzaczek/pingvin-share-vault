import { useModals } from "@mantine/modals";
import { useEffect, useRef } from "react";
import { FileUpload } from "../types/File.type";
import { getFilesFromEvent } from "../utils/file.util";

type UseClipboardPasteOptions = {
  onFiles: (files: FileUpload[]) => void;
  disabled?: boolean;
};

// Ctrl+V anywhere on the page adds what is on the clipboard to the upload:
// files and folders copied in the file manager, a screenshot, or text, which
// becomes a .txt file. A paste into a text field, or while a modal is open,
// is left alone.
const useClipboardPaste = ({
  onFiles,
  disabled = false,
}: UseClipboardPasteOptions) => {
  const modals = useModals();
  const isModalOpen = modals.modals.length > 0;

  // the listener is added once, so it reads the current values from here
  const stateRef = useRef({ onFiles, disabled, isModalOpen });
  stateRef.current = { onFiles, disabled, isModalOpen };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (stateRef.current.disabled || stateRef.current.isModalOpen) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      let filesToUpload: FileUpload[] = [];
      const hasFiles = Array.from(clipboardData.items ?? []).some(
        (item) => item.kind === "file",
      );

      if (hasFiles) {
        // before the await, the browser decides about the default right away
        e.preventDefault();

        const pastedFiles = (await getFilesFromEvent(e)) as FileUpload[];
        if (stateRef.current.disabled || stateRef.current.isModalOpen) return;

        filesToUpload = pastedFiles.map((file) => {
          // every screenshot is called image.png, give each its own name
          const isScreenshot =
            file.name === "image.png" && !file.webkitRelativePath;
          const readyFile = (
            isScreenshot
              ? new File([file], `image_${Date.now()}.png`, {
                  type: file.type,
                  lastModified: file.lastModified,
                })
              : file
          ) as FileUpload;

          readyFile.uploadingProgress = 0;
          return readyFile;
        });
      } else {
        const pastedText = clipboardData.getData("text/plain");
        if (!pastedText) return;

        // Create a sanitised file name from the pasted text
        const safeName = pastedText
          .substring(0, 50)
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim();
        const fileName = `${safeName || "clipboard_paste"}.txt`;

        const fileUpload = new File([pastedText], fileName, {
          type: "text/plain",
        }) as FileUpload;
        fileUpload.uploadingProgress = 0;
        filesToUpload.push(fileUpload);
      }

      if (filesToUpload.length > 0) {
        e.preventDefault();
        stateRef.current.onFiles(filesToUpload);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);
};

export default useClipboardPaste;
