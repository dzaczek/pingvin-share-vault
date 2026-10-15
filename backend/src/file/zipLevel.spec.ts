import { streamedZipLevel } from "./zipLevel";

describe("streamedZipLevel", () => {
  it("never compresses a streamed zip harder than level 4", () => {
    expect(streamedZipLevel(9)).toBe(4);
    expect(streamedZipLevel(4)).toBe(4);
  });

  it("keeps a lower level the admin picked", () => {
    expect(streamedZipLevel(2)).toBe(2);
    expect(streamedZipLevel(0)).toBe(0);
  });
});
