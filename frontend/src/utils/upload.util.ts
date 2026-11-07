import { AxiosError, type AxiosProgressEvent } from "axios";

const UPLOAD_INACTIVITY_TIMEOUT_MS = 60_000;

export const MAX_CHUNK_UPLOAD_RETRIES = 3;
export const CHUNK_RETRY_DELAY_MS = 5_000;

// A chunk is only sent again when the failure can go away by itself: no
// response at all (network, aborted by the inactivity timeout), the server
// being briefly unavailable, or rate limiting. Anything else, such as a full
// quota, a locked share or a rejected file, fails the same way every time, so
// retrying it would loop forever.
export const isRetryableUploadError = (error: unknown): boolean => {
  if (!(error instanceof AxiosError)) return false;
  const status = error.response?.status;
  if (status === undefined) return true;
  return status === 429 || status >= 500;
};

export type UploadProgressHandler = (progressEvent: AxiosProgressEvent) => void;

type UploadRequest<T> = (
  signal: AbortSignal,
  onUploadProgress: UploadProgressHandler,
) => Promise<T>;

export const withUploadInactivityTimeout = async <T>(
  request: UploadRequest<T>,
  onUploadProgress?: UploadProgressHandler,
): Promise<T> => {
  const controller = new AbortController();
  let inactivityTimeout: ReturnType<typeof setTimeout> | undefined;

  const resetInactivityTimeout = () => {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(
      () => controller.abort(),
      UPLOAD_INACTIVITY_TIMEOUT_MS,
    );
  };

  resetInactivityTimeout();

  try {
    return await request(controller.signal, (progressEvent) => {
      resetInactivityTimeout();
      onUploadProgress?.(progressEvent);
    });
  } finally {
    clearTimeout(inactivityTimeout);
  }
};
