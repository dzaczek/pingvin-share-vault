import {
  Button,
  Center,
  createStyles,
  Group,
  Text,
  Menu,
  SimpleGrid,
  Stack,
  ThemeIcon,
  useMantineColorScheme,
} from "@mantine/core";
import { Dropzone as MantineDropzone } from "@mantine/dropzone";
import React, { ForwardedRef, useRef, useState } from "react";
import {
  TbCloudUpload,
  TbUpload,
  TbFolder,
  TbFiles,
  TbPlus,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import { fromEvent } from "file-selector";
import useUiStyle, {
  GlassSettings,
  useUploadPanel,
} from "../../hooks/uiStyle.hook";
import { useIsHydrated } from "../../hooks/useIsHydrated.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import { FileUpload } from "../../types/File.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import { glassSurface } from "../../styles/glass.style";
import { precisionTokens } from "../../styles/precision.style";

// The panel rows are sized off the golden ratio. The icon sets the scale,
// the row is the icon times phi, the title and the gap next to the icon are
// the icon over phi squared, the hint is one half step below the title.
const PHI = 1.618;
const ROW_ICON = 48;
const ROW_HEIGHT = Math.round(ROW_ICON * PHI);
const ROW_GAP = Math.round(ROW_ICON / PHI ** 2);
const ROW_TITLE = ROW_GAP;
const ROW_HINT = Math.round(ROW_TITLE / Math.sqrt(PHI));

const useStyles = createStyles((theme, glass: GlassSettings | null) => ({
  wrapper: {
    position: "relative",
    marginBottom: 30,
  },

  dropzone: {
    borderWidth: 1,
    paddingBottom: 50,
  },

  icon: {
    color:
      theme.colorScheme === "dark"
        ? theme.colors.dark[3]
        : theme.colors.gray[4],
  },

  control: {
    position: "absolute",
    bottom: -20,
  },

  // files and folders get a card each, doubled to win over the dropzone's
  // own border and background
  card: glass
    ? {
        "&&": {
          ...glassSurface(theme, glass),
          borderRadius: 28,
          padding: "36px 20px",
          cursor: "pointer",
          transition: "filter 120ms ease",
          "&:hover": { filter: "brightness(1.04)" },
          "&[data-accept]": {
            boxShadow: `0 0 0 3px ${theme.fn.rgba(theme.fn.primaryColor(), 0.6)}`,
          },
        },
      }
    : {},

  // a touch screen gets the tap wording, everything else click and drop
  mobileDescription: {
    display: "none",
    "@media (pointer: coarse)": {
      display: "inline",
    },
  },

  desktopDescription: {
    display: "inline",
    "@media (pointer: coarse)": {
      display: "none",
    },
  },
}));

const traverseDirectory = async (entry: any, path = ""): Promise<File[]> => {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file: File) => {
        const relativePath = path ? `${path}/${file.name}` : file.name;
        Object.defineProperty(file, "webkitRelativePath", {
          value: relativePath,
          writable: true,
          configurable: true,
        });
        resolve([file]);
      });
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readEntries = (): Promise<any[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries(
          (entries: any[]) => resolve(entries),
          () => resolve([]),
        );
      });
    };

    let entries: any[] = [];
    let readBatch = await readEntries();
    while (readBatch.length > 0) {
      entries = entries.concat(readBatch);
      readBatch = await readEntries();
    }

    const promises = entries.map((e) =>
      traverseDirectory(e, path ? `${path}/${entry.name}` : entry.name),
    );
    const results = await Promise.all(promises);
    return results.flat();
  }
  return [];
};

const getFilesFromEvent = async (event: any): Promise<any[]> => {
  // Chrome opens the file picker through the File System Access API, which
  // hands back FileSystemFileHandle[] instead of a change/drop event
  if (Array.isArray(event)) {
    const filePromises = event.map(async (item: any) => {
      if (item && typeof item.getFile === "function") {
        return await item.getFile();
      }
      return item;
    });
    return await Promise.all(filePromises);
  }

  if (event?.dataTransfer) {
    const items = event.dataTransfer.items;
    if (!items) return [];

    const filePromises: Promise<File[]>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          filePromises.push(traverseDirectory(entry));
        } else {
          const file = item.getAsFile();
          if (file) {
            filePromises.push(Promise.resolve([file]));
          }
        }
      }
    }
    const fileArrays = await Promise.all(filePromises);
    return fileArrays.flat();
  }

  if (event?.target?.files) {
    return Array.from(event.target.files) as File[];
  }

  return await fromEvent(event);
};

const Dropzone = ({
  title,
  isUploading,
  maxShareSize,
  currentFilesSize = 0,
  onFilesChanged,
}: {
  title?: string;
  isUploading: boolean;
  maxShareSize: number;
  currentFilesSize?: number;
  onFilesChanged: (files: FileUpload[]) => void;
}) => {
  const t = useTranslate();
  const { glass } = useUiStyle();
  const uploadPanel = useUploadPanel();
  const { classes } = useStyles(glass);
  const openRef = useRef<() => void>();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isHydrated = useIsHydrated();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";

  // the directory picker is a browser capability, so it cannot be decided
  // until the markup the server produced has been hydrated
  const isFolderUploadSupported =
    isHydrated &&
    typeof HTMLInputElement !== "undefined" &&
    "webkitdirectory" in HTMLInputElement.prototype;
  const noFolder = isHydrated && !isFolderUploadSupported;
  const isMac = isHydrated && /Macintosh|Mac OS X/.test(navigator.userAgent);

  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = event.target.files;
    if (!filesList) return;
    const filesArray = Array.from(filesList) as FileUpload[];

    const files = filesArray.map((newFile) => {
      newFile.uploadingProgress = 0;
      return newFile;
    });

    const fileSizeSum = files.reduce((n, { size }) => n + size, 0);

    if (fileSizeSum + currentFilesSize > maxShareSize) {
      toast.error(
        t("upload.dropzone.notify.file-too-big", {
          maxSize: byteToHumanSizeString(maxShareSize),
        }),
      );
    } else {
      onFilesChanged(files);
    }

    event.target.value = "";
  };

  const handleDrop = (files: FileUpload[]) => {
    const fileSizeSum = files.reduce((n, { size }) => n + size, 0);

    if (fileSizeSum + currentFilesSize > maxShareSize) {
      toast.error(
        t("upload.dropzone.notify.file-too-big", {
          maxSize: byteToHumanSizeString(maxShareSize),
        }),
      );
    } else {
      files = files.map((newFile) => {
        newFile.uploadingProgress = 0;
        return newFile;
      });
      onFilesChanged(files);
    }
  };

  const card = (kind: "files" | "folder") => (
    <MantineDropzone
      onReject={(e) => {
        toast.error(e[0].errors[0].message);
      }}
      disabled={isUploading}
      getFilesFromEvent={getFilesFromEvent}
      onDrop={handleDrop}
      className={classes.card}
      {...(kind === "files"
        ? { openRef: openRef as ForwardedRef<() => void> }
        : {
            activateOnClick: false,
            // Mantine sets the dropzone's own click and key handlers after
            // ours, so catch them first; its key handler opens the file picker
            onClickCapture: () => folderInputRef.current?.click(),
            onKeyDownCapture: (event: React.KeyboardEvent) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              folderInputRef.current?.click();
            },
          })}
    >
      <div style={{ pointerEvents: "none" }}>
        <Group position="center">
          {kind === "files" ? <TbFiles size={44} /> : <TbFolder size={44} />}
        </Group>
        <Text align="center" weight={700} size="lg" mt="md">
          {kind === "files" && title ? (
            title
          ) : (
            <FormattedMessage id={`upload.dropzone.glass.${kind}.title`} />
          )}
        </Text>
        <Text align="center" size="sm" mt="xs" color="dimmed">
          <span className={classes.mobileDescription}>
            <FormattedMessage
              id={`upload.dropzone.glass.${kind}.description.mobile`}
            />
          </span>
          <span className={classes.desktopDescription}>
            <FormattedMessage
              id={`upload.dropzone.glass.${kind}.description`}
            />
          </span>
        </Text>
      </div>
    </MantineDropzone>
  );

  const row = (kind: "files" | "folder") => (
    <MantineDropzone
      onReject={(e) => {
        toast.error(e[0].errors[0].message);
      }}
      disabled={isUploading}
      getFilesFromEvent={getFilesFromEvent}
      onDrop={handleDrop}
      sx={(theme) => {
        const dark = theme.colorScheme === "dark";
        return {
          minHeight: ROW_HEIGHT,
          padding: `${(ROW_HEIGHT - ROW_ICON) / 2}px ${ROW_GAP}px`,
          borderRadius: glass ? theme.radius.lg : 8,
          border: glass
            ? `1px dashed rgba(255, 255, 255, ${dark ? 0.25 : 0.8})`
            : `1px dashed ${precisionTokens(theme).border}`,
          background: glass
            ? `rgba(255, 255, 255, ${dark ? 0.04 : 0.25})`
            : "transparent",
          "&:hover": {
            background: glass
              ? `rgba(255, 255, 255, ${dark ? 0.1 : 0.45})`
              : precisionTokens(theme).hover,
          },
        };
      }}
      {...(kind === "files"
        ? { openRef: openRef as ForwardedRef<() => void> }
        : {
            activateOnClick: false,
            onClickCapture: () => folderInputRef.current?.click(),
            onKeyDownCapture: (event: React.KeyboardEvent) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              folderInputRef.current?.click();
            },
          })}
    >
      <Group noWrap spacing={ROW_GAP} style={{ pointerEvents: "none" }}>
        <ThemeIcon
          size={ROW_ICON}
          radius={999}
          variant={kind === "files" ? "filled" : "light"}
        >
          {kind === "files" ? <TbPlus size={24} /> : <TbFolder size={22} />}
        </ThemeIcon>
        <div>
          <Text weight={650} size={ROW_TITLE}>
            {kind === "files" && title ? (
              title
            ) : (
              <FormattedMessage id={`upload.precision.add-${kind}`} />
            )}
          </Text>
          <Text size={ROW_HINT} color="dimmed">
            <FormattedMessage
              id={`upload.precision.${kind}-hint`}
              values={{ maxSize: byteToHumanSizeString(maxShareSize) }}
            />
          </Text>
        </div>
      </Group>
    </MantineDropzone>
  );

  // the upload panel (Precision, or Glass when asked): compact rows, and
  // files can be dropped anywhere on the page, the way WeTransfer does it
  if (uploadPanel)
    return (
      <div>
        <input
          type="file"
          ref={folderInputRef}
          style={{ display: "none" }}
          {...({
            webkitdirectory: "",
            directory: "",
          } as any)}
          multiple
          onChange={handleFolderSelect}
        />
        <Stack spacing="xs">
          {row("files")}
          {isFolderUploadSupported && row("folder")}
        </Stack>
        <MantineDropzone.FullScreen
          active={!isUploading}
          onReject={(e) => {
            toast.error(e[0].errors[0].message);
          }}
          getFilesFromEvent={getFilesFromEvent}
          onDrop={handleDrop}
        >
          <Center style={{ height: "70vh", pointerEvents: "none" }}>
            <div>
              <Group position="center">
                <TbCloudUpload size={64} />
              </Group>
              <Text align="center" weight={650} size="xl" mt="md">
                <FormattedMessage id="upload.precision.drop" />
              </Text>
            </div>
          </Center>
        </MantineDropzone.FullScreen>
      </div>
    );

  if (glass)
    return (
      <div className={classes.wrapper}>
        <input
          type="file"
          ref={folderInputRef}
          style={{ display: "none" }}
          {...({
            webkitdirectory: "",
            directory: "",
          } as any)}
          multiple
          onChange={handleFolderSelect}
        />
        <SimpleGrid
          cols={isFolderUploadSupported ? 2 : 1}
          breakpoints={[{ maxWidth: "sm", cols: 1 }]}
        >
          {card("files")}
          {isFolderUploadSupported && card("folder")}
        </SimpleGrid>
        <Text align="center" size="sm" mt="md" color="dimmed">
          <span className={classes.mobileDescription}>
            <FormattedMessage
              id="upload.dropzone.glass.hint.mobile"
              values={{ maxSize: byteToHumanSizeString(maxShareSize) }}
            />
          </span>
          <span className={classes.desktopDescription}>
            <FormattedMessage
              id="upload.dropzone.glass.hint"
              values={{
                maxSize: byteToHumanSizeString(maxShareSize),
                shortcut: isMac ? "⌘+V" : "Ctrl+V",
              }}
            />
          </span>
        </Text>
      </div>
    );

  return (
    <div className={classes.wrapper}>
      <input
        type="file"
        ref={folderInputRef}
        style={{ display: "none" }}
        {...({
          webkitdirectory: "",
          directory: "",
        } as any)}
        multiple
        onChange={handleFolderSelect}
      />
      <MantineDropzone
        onReject={(e) => {
          toast.error(e[0].errors[0].message);
        }}
        disabled={isUploading}
        openRef={openRef as ForwardedRef<() => void>}
        getFilesFromEvent={getFilesFromEvent}
        onDrop={handleDrop}
        className={classes.dropzone}
        radius="md"
      >
        <div style={{ pointerEvents: "none" }}>
          <Group position="center">
            <TbCloudUpload size={50} />
          </Group>
          <Text align="center" weight={700} size="lg" mt="xl">
            {title || <FormattedMessage id="upload.dropzone.title" />}
          </Text>
          <Text align="center" size="sm" mt="xs" color="dimmed">
            <span className={classes.mobileDescription}>
              <FormattedMessage
                id={
                  noFolder
                    ? "upload.dropzone.description.mobile.no-folder"
                    : "upload.dropzone.description.mobile"
                }
                values={{ maxSize: byteToHumanSizeString(maxShareSize) }}
              />
            </span>
            <span className={classes.desktopDescription}>
              <FormattedMessage
                id={
                  noFolder
                    ? "upload.dropzone.description.desktop.no-folder"
                    : "upload.dropzone.description.desktop"
                }
                values={{
                  maxSize: byteToHumanSizeString(maxShareSize),
                  shortcut: isMac ? "⌘+V" : "Ctrl+V",
                }}
              />
            </span>
          </Text>
        </div>
      </MantineDropzone>
      <Center>
        {isFolderUploadSupported && (
          <Button
            className={classes.control}
            variant={dark ? "filled" : "light"}
            size="sm"
            radius="xl"
            disabled={isUploading}
            onClick={() => folderInputRef.current?.click()}
          >
            <TbFolder style={{ marginRight: 6 }} />
            <FormattedMessage
              id={
                currentFilesSize > 0
                  ? "upload.button.folder.append"
                  : "upload.button.folder"
              }
            />
          </Button>
        )}
      </Center>
    </div>
  );
};
export default Dropzone;
