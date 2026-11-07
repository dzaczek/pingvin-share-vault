import { BadRequestException } from "@nestjs/common";
import { FileService } from "./file.service";

// The direct to S3 upload (upload-init / upload-complete) skipped the checks
// the chunked S3 upload makes: a completed share could get new or replaced
// objects after it was scanned, a name in use overwrote the existing object,
// and an unbounded part count tied up the server signing URLs.

const construct = (share: unknown, s3: unknown) => {
  const unused = {} as any;
  const prisma = {
    share: {
      findUnique: async () => share,
      findFirst: async () => ({ storageProvider: "S3" }),
    },
  };
  return new FileService(
    prisma as any,
    {} as any,
    s3 as any,
    { get: () => true } as any,
    unused,
    { t: (key: string) => key } as any,
    unused,
    unused,
  );
};

const openShare = { uploadLocked: false, files: [], updatedAt: new Date() };

describe("direct to S3 uploads", () => {
  const s3 = () => ({
    createPreSignedUploadUrls: jest.fn(async () => ({ urls: [] })),
    completePreSignedUpload: jest.fn(async () => ({ id: "f", name: "a" })),
  });

  it("refuses to start or finish an upload into a completed share", async () => {
    const storage = s3();
    const service = construct({ ...openShare, uploadLocked: true }, storage);

    await expect(
      service.createPreSignedUploadUrls("s1", "a.bin", 2),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.completePreSignedUpload("s1", undefined, "a.bin", "u", []),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.createPreSignedUploadUrls).not.toHaveBeenCalled();
    expect(storage.completePreSignedUpload).not.toHaveBeenCalled();
  });

  it("refuses a name already in the share, whose object it would replace", async () => {
    const storage = s3();
    const service = construct(
      { ...openShare, files: [{ name: "a.bin" }] },
      storage,
    );

    await expect(
      service.completePreSignedUpload("s1", undefined, "a.bin", "u", []),
    ).rejects.toMatchObject({ response: { message: "file.nameInUse" } });
    expect(storage.completePreSignedUpload).not.toHaveBeenCalled();
  });

  it("refuses a part count S3 would never accept", async () => {
    const storage = s3();
    const service = construct(openShare, storage);

    for (const parts of [0, 10_001, 1e8, 1.5, Number.NaN]) {
      await expect(
        service.createPreSignedUploadUrls("s1", "a.bin", parts),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(storage.createPreSignedUploadUrls).not.toHaveBeenCalled();
  });

  it("still signs a normal upload", async () => {
    const storage = s3();
    const service = construct(openShare, storage);

    await service.createPreSignedUploadUrls("s1", "a.bin", 3);

    expect(storage.createPreSignedUploadUrls).toHaveBeenCalledWith(
      "s1",
      "a.bin",
      3,
    );
  });
});
