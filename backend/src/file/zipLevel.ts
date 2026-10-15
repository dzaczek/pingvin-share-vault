// A zip built while it downloads is there to hand over every file in one go,
// not to save bytes. Harder compression only slows the download and costs
// server CPU on every request. The admin setting still applies in full to the
// zip built in the background after upload.
export const MAX_STREAMED_ZIP_LEVEL = 4;

export const streamedZipLevel = (configured: number) =>
  Math.min(configured, MAX_STREAMED_ZIP_LEVEL);
