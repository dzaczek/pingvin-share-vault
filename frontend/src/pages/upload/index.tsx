import {
  Box,
  Button,
  Center,
  Divider,
  Group,
  Paper,
  RingProgress,
  Space,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { cleanNotifications } from "@mantine/notifications";
import { AxiosError } from "axios";
import pLimit from "p-limit";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TbCheck, TbShieldLock } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import Dropzone from "../../components/upload/Dropzone";
import FileList from "../../components/upload/FileList";
import showCompletedUploadModal, {
  Body as CompletedUploadBody,
} from "../../components/upload/modals/showCompletedUploadModal";
import showCreateUploadModal, {
  CreateUploadModalBody,
  SimplifiedCreateUploadModalModal,
} from "../../components/upload/modals/showCreateUploadModal";
import useConfig from "../../hooks/config.hook";
import useConfirmLeave from "../../hooks/confirm-leave.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUiStyle from "../../hooks/uiStyle.hook";
import useUser from "../../hooks/user.hook";
import shareService from "../../services/share.service";
import { FileUpload } from "../../types/File.type";
import { CompletedShare, CreateShare, Share } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import { useRouter } from "next/router";
import {
  getNormalizedFileName,
  filterDuplicateFiles,
} from "../../utils/file.util";

const promiseLimit = pLimit(3);
let errorToastShown = false;
let createdShare: Share;

const Upload = ({
  maxShareSize,
  isReverseShare = false,
  simplified,
}: {
  maxShareSize?: number;
  isReverseShare: boolean;
  simplified: boolean;
}) => {
  const modals = useModals();
  const router = useRouter();
  const t = useTranslate();

  const { user } = useUser();
  const config = useConfig();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isUploading, setisUploading] = useState(false);
  // Precision keeps the whole flow in one panel instead of two modals
  const precision = useUiStyle().name === "precision";
  const [completedShare, setCompletedShare] = useState<CompletedShare>();

  useConfirmLeave({
    message: t("upload.notify.confirm-leave"),
    enabled: isUploading,
  });

  const chunkSize = useRef(parseInt(config.get("share.chunkSize")));

  maxShareSize ??= user?.shareSizeLimit
    ? parseInt(user.shareSizeLimit)
    : parseInt(config.get("share.maxSize"));

  const currentFilesSize = useMemo(() => {
    return files.reduce((acc, file) => acc + file.size, 0);
  }, [files]);

  const autoOpenCreateUploadModal = config.get("share.autoOpenShareModal");

  const uploadFiles = async (share: CreateShare, files: FileUpload[]) => {
    setisUploading(true);

    try {
      const isReverseShare = router.pathname != "/upload";
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);
      createdShare = await shareService.create(
        { ...share, size: totalSize },
        isReverseShare,
      );
    } catch (e) {
      toast.axiosError(e);
      setisUploading(false);
      return;
    }

    const fileUploadPromises = files.map(async (file, fileIndex) =>
      // Limit the number of concurrent uploads to 3
      promiseLimit(async () => {
        let fileId;

        const setFileProgress = (progress: number) => {
          setFiles((files) =>
            files.map((file, callbackIndex) => {
              if (fileIndex == callbackIndex) {
                file.uploadingProgress = progress;
              }
              return file;
            }),
          );
        };

        setFileProgress(1);

        let chunks = Math.ceil(file.size / chunkSize.current);

        // If the file is 0 bytes, we still need to upload 1 chunk
        if (chunks == 0) chunks++;

        for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
          const from = chunkIndex * chunkSize.current;
          const to = from + chunkSize.current;
          const blob = file.slice(from, to);
          try {
            await shareService
              .uploadFile(
                createdShare.id,
                blob,
                {
                  id: fileId,
                  name: getNormalizedFileName(file),
                },
                chunkIndex,
                chunks,
                (progressEvent) => {
                  if (progressEvent.total && file.size > 0) {
                    const chunkProgress =
                      progressEvent.loaded / progressEvent.total;
                    const uploadedBytesBeforeThisChunk =
                      chunkIndex * chunkSize.current;
                    const uploadedBytesInThisChunk = blob.size * chunkProgress;
                    const totalUploaded =
                      uploadedBytesBeforeThisChunk + uploadedBytesInThisChunk;
                    const overallPercent = (totalUploaded / file.size) * 100;
                    setFileProgress(Math.min(overallPercent, 99.9));
                  }
                },
              )
              .then((response) => {
                fileId = response.id;
              });

            setFileProgress(((chunkIndex + 1) / chunks) * 100);
          } catch (e) {
            if (
              e instanceof AxiosError &&
              e.response?.data.error == "unexpected_chunk_index"
            ) {
              // Retry with the expected chunk index
              chunkIndex = e.response!.data!.expectedChunkIndex - 1;
              continue;
            } else {
              setFileProgress(-1);
              // Retry after 5 seconds
              await new Promise((resolve) => setTimeout(resolve, 5000));
              chunkIndex = -1;

              continue;
            }
          }
        }
      }),
    );

    Promise.all(fileUploadPromises);
  };

  const createUploadOptions = {
    isUserSignedIn: user ? true : false,
    isReverseShare,
    appUrl: config.get("general.appUrl"),
    defaultAppUrl: config.get("general.appUrl", true),
    allowUnauthenticatedShares: config.get(
      "security.allowUnauthenticatedShares",
    ),
    enableEmailRecepients: config.get("share.enableShareEmailRecipients"),
    enableUserRecipients: config.get("share.enableUserRecipients"),
    maxExpiration: user?.isAdmin
      ? { value: 0, unit: "days" }
      : config.get("share.maxExpiration"),
    defaultExpiration: config.get("share.defaultExpiration"),
    shareIdLength: config.get("share.shareIdLength"),
    simplified,
  };

  const showCreateUploadModalCallback = (files: FileUpload[]) => {
    showCreateUploadModal(modals, createUploadOptions, files, uploadFiles);
  };

  const handleDropzoneFilesChanged = (newFiles: FileUpload[]) => {
    const filtered = filterDuplicateFiles(newFiles, files, (normalizedName) =>
      toast.error(
        t("upload.notify.duplicate-skipped", { name: normalizedName }),
      ),
    );
    if (filtered.length === 0) return;

    if (autoOpenCreateUploadModal && !precision) {
      setFiles(filtered);
      showCreateUploadModalCallback(filtered);
    } else {
      setFiles((oldArr) => [...oldArr, ...filtered]);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (modals.modals.length > 0) {
        return;
      }

      const clipboardData = e.clipboardData;

      if (!clipboardData) {
        return;
      }

      if (clipboardData?.getData("text/plain")) {
        const pastedText = clipboardData.getData("text/plain");
        if (!pastedText) {
          return;
        }

        // Create a sanitised file name from the pasted text
        const safeName = pastedText
          .substring(0, 50)
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim();
        const fileName = `${safeName || "clipboard_paste"}.txt`;

        const file = new File([pastedText], fileName, {
          type: "text/plain",
        });
        const fileUpload = file as FileUpload;
        fileUpload.uploadingProgress = 0;

        const filtered = filterDuplicateFiles(
          [fileUpload],
          files,
          (normalizedName) =>
            toast.error(
              t("upload.notify.duplicate-skipped", { name: normalizedName }),
            ),
        );
        if (filtered.length === 0) return;

        if (autoOpenCreateUploadModal && !precision) {
          setFiles(filtered);
          showCreateUploadModalCallback(filtered);
        } else {
          setFiles((oldArr) => [...oldArr, ...filtered]);
        }
      }
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [autoOpenCreateUploadModal, modals.modals.length, precision]);

  useEffect(() => {
    // Check if there are any files that failed to upload
    const fileErrorCount = files.filter(
      (file) => file.uploadingProgress == -1,
    ).length;

    if (fileErrorCount > 0) {
      if (!errorToastShown) {
        toast.error(
          t("upload.notify.count-failed", { count: fileErrorCount }),
          {
            withCloseButton: false,
            autoClose: false,
          },
        );
      }
      errorToastShown = true;
    } else {
      cleanNotifications();
      errorToastShown = false;
    }

    // Complete share
    if (
      files.length > 0 &&
      files.every((file) => file.uploadingProgress >= 100) &&
      fileErrorCount == 0
    ) {
      shareService
        .completeShare(createdShare.id)
        .then((share) => {
          setisUploading(false);
          if (precision) setCompletedShare(share);
          else
            showCompletedUploadModal(
              modals,
              share,
              config.get("general.appUrl"),
              config.get("general.appUrl", true),
            );
          setFiles([]);
        })
        .catch(() => toast.error(t("upload.notify.generic-error")));
    }
  }, [files]);

  if (user && user.allowShare === false && !isReverseShare) {
    return (
      <>
        <Meta title={t("upload.title")} />
        <Center style={{ height: "70vh" }}>
          <Stack align="center" spacing={10}>
            <TbShieldLock size={48} color="gray" />
            <Title order={3}>
              <FormattedMessage id="upload.error.not-allowed.title" />
            </Title>
            <Text color="dimmed" align="center">
              <FormattedMessage id="upload.error.not-allowed.description" />
            </Text>
            <Space h={5} />
            <Button component={Link} href="/account/shares" variant="light">
              <FormattedMessage id="account.shares.title" />
            </Button>
          </Stack>
        </Center>
      </>
    );
  }

  if (precision) {
    const uploadedBytes = files.reduce(
      (n, file) => n + (file.size * Math.max(file.uploadingProgress, 0)) / 100,
      0,
    );
    const percent = currentFilesSize
      ? Math.floor((uploadedBytes / currentFilesSize) * 100)
      : 0;

    return (
      <>
        <Meta title={t("upload.title")} />
        <Paper p="lg" mx="auto" sx={{ maxWidth: 460 }}>
          {completedShare ? (
            <Stack>
              <Group spacing="sm" noWrap>
                <ThemeIcon color="green" radius={999} size={36}>
                  <TbCheck size={20} />
                </ThemeIcon>
                <Title order={3}>
                  <FormattedMessage id="upload.precision.done" />
                </Title>
              </Group>
              <CompletedUploadBody
                share={completedShare}
                appUrl={config.get("general.appUrl")}
                defaultAppUrl={config.get("general.appUrl", true)}
                onDone={
                  isReverseShare
                    ? undefined
                    : () => setCompletedShare(undefined)
                }
              />
            </Stack>
          ) : isUploading ? (
            <Stack align="center" spacing="xs" py="md">
              <RingProgress
                size={180}
                thickness={10}
                roundCaps
                sections={[{ value: percent, color: "precision" }]}
                label={
                  <Text align="center" weight={650} size={28}>
                    {percent}%
                  </Text>
                }
              />
              <Text weight={600}>
                <FormattedMessage id="upload.precision.uploading" />
              </Text>
              <Text size="sm" color="dimmed">
                <FormattedMessage
                  id="upload.precision.progress"
                  values={{
                    done: byteToHumanSizeString(uploadedBytes),
                    total: byteToHumanSizeString(currentFilesSize),
                  }}
                />
              </Text>
            </Stack>
          ) : (
            <Stack>
              <Dropzone
                maxShareSize={maxShareSize}
                currentFilesSize={currentFilesSize}
                onFilesChanged={handleDropzoneFilesChanged}
                isUploading={isUploading}
              />
              {files.length > 0 && (
                <>
                  <Text size="xs" color="dimmed">
                    <FormattedMessage
                      id="upload.precision.summary"
                      values={{
                        count: files.length,
                        size: byteToHumanSizeString(currentFilesSize),
                        max: byteToHumanSizeString(maxShareSize),
                      }}
                    />
                  </Text>
                  <Box sx={{ maxHeight: 240, overflowY: "auto" }}>
                    <FileList<FileUpload> files={files} setFiles={setFiles} />
                  </Box>
                  <Divider />
                  {simplified ? (
                    <SimplifiedCreateUploadModalModal
                      options={createUploadOptions}
                      files={files}
                      uploadCallback={uploadFiles}
                    />
                  ) : (
                    <CreateUploadModalBody
                      options={createUploadOptions}
                      files={files}
                      uploadCallback={uploadFiles}
                    />
                  )}
                </>
              )}
            </Stack>
          )}
        </Paper>
      </>
    );
  }

  return (
    <>
      <Meta title={t("upload.title")} />
      <Group position="right" mb={20}>
        <Button
          loading={isUploading}
          disabled={files.length <= 0}
          onClick={() => showCreateUploadModalCallback(files)}
        >
          <FormattedMessage id="common.button.share" />
        </Button>
      </Group>
      <Dropzone
        title={
          !autoOpenCreateUploadModal && files.length > 0
            ? t("share.edit.append-upload")
            : undefined
        }
        maxShareSize={maxShareSize}
        currentFilesSize={currentFilesSize}
        onFilesChanged={handleDropzoneFilesChanged}
        isUploading={isUploading}
      />
      {files.length > 0 && (
        <FileList<FileUpload> files={files} setFiles={setFiles} />
      )}
    </>
  );
};
export default Upload;
