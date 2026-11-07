import { AxiosError, AxiosHeaders } from "axios";
import { isRetryableUploadError } from "./upload.util";

// A failed chunk used to be retried every five seconds from the start of the
// file, with no limit, whatever the server said. A full quota or a locked
// share then kept the browser uploading the same file forever.

const httpError = (status: number) =>
  new AxiosError("failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });

describe("isRetryableUploadError", () => {
  it("retries when no response came back (network error, aborted request)", () => {
    expect(isRetryableUploadError(new AxiosError("Network Error"))).toBe(true);
  });

  it("retries a server error or rate limiting", () => {
    expect(isRetryableUploadError(httpError(500))).toBe(true);
    expect(isRetryableUploadError(httpError(503))).toBe(true);
    expect(isRetryableUploadError(httpError(429))).toBe(true);
  });

  it("does not retry answers that will not change", () => {
    // 413 full quota or share size, 403 locked or blocked share,
    // 400 rejected request, 404 share gone
    for (const status of [400, 403, 404, 413]) {
      expect(isRetryableUploadError(httpError(status))).toBe(false);
    }
  });

  it("does not retry errors that did not come from the request", () => {
    expect(isRetryableUploadError(new Error("boom"))).toBe(false);
    expect(isRetryableUploadError(undefined)).toBe(false);
  });
});
