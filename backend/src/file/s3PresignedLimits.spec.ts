import {
  CompleteMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { S3FileService } from "./s3.service";

// Presigned parts go straight to the bucket, so the size is only known once
// the upload is completed. The share size limit and the storage quota that
// the chunked path checks were never applied to it.

const FILE_ID = "6f1c2c4e-8a8b-4f7e-9a51-0b3e6a1d2c3f";

describe("completing a presigned S3 upload", () => {
  let share: any;
  let objectSize: number;
  let usage: number;
  let send: jest.Mock;
  let prisma: any;
  let service: S3FileService;

  const complete = () =>
    service.completePreSignedUpload("s1", FILE_ID, "a.bin", "up1", [
      { ETag: "e1", PartNumber: 1 },
    ]);
  const sent = (type: any) =>
    send.mock.calls.some(([command]) => command instanceof type);

  beforeEach(() => {
    objectSize = 300;
    usage = 0;
    share = {
      id: "s1",
      files: [{ size: "600" }],
      creatorId: null,
      creator: null,
      reverseShare: null,
    };
    prisma = {
      share: { findUnique: jest.fn(async () => share) },
      file: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => ({})),
        findMany: jest.fn(async () => [{ size: `${usage}` }]),
      },
    };
    const config = {
      get: (key: string) => (key === "share.maxSize" ? 1000 : ""),
    };
    service = new S3FileService(
      prisma,
      config as any,
      { t: (key: string) => key } as any,
    );
    send = jest.fn(async (command) =>
      command instanceof HeadObjectCommand ? { ContentLength: objectSize } : {},
    );
    jest
      .spyOn(service as any, "getS3Instance")
      .mockReturnValue({ send } as never);
  });

  it("keeps an object that fits", async () => {
    await complete();
    expect(sent(CompleteMultipartUploadCommand)).toBe(true);
    expect(sent(DeleteObjectCommand)).toBe(false);
    expect(prisma.file.create).toHaveBeenCalled();
  });

  it("removes an object that takes the share over its limit", async () => {
    objectSize = 5000;
    await expect(complete()).rejects.toMatchObject({ status: 413 });
    expect(sent(DeleteObjectCommand)).toBe(true);
    expect(prisma.file.create).not.toHaveBeenCalled();
  });

  it("uses the creator's limit", async () => {
    share.creator = { shareSizeLimit: "700", storageQuotaLimit: null };
    share.creatorId = "u1";
    await expect(complete()).rejects.toMatchObject({ status: 413 });
    expect(prisma.file.create).not.toHaveBeenCalled();
  });

  it("removes an object that takes the owner over their quota", async () => {
    share.creator = { shareSizeLimit: null, storageQuotaLimit: "1000" };
    share.creatorId = "u1";
    usage = 900;
    await expect(complete()).rejects.toMatchObject({ status: 400 });
    expect(sent(DeleteObjectCommand)).toBe(true);
    expect(prisma.file.create).not.toHaveBeenCalled();
  });
});
