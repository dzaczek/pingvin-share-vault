import { BadRequestException, HttpException } from "@nestjs/common";
import { S3FileService } from "./s3.service";

describe("S3FileService share limits", () => {
  let share: any;
  let send: jest.Mock;
  let service: S3FileService;

  const upload = (bytes: number) =>
    service.create(
      Buffer.alloc(bytes).toString("base64"),
      { index: 0, total: 1 },
      { name: "a.bin" },
      "s1",
    );

  beforeEach(() => {
    share = {
      id: "s1",
      uploadLocked: false,
      files: [{ size: "600" }],
      creator: null,
      reverseShare: null,
    };
    const prisma = { share: { findUnique: jest.fn(async () => share) } };
    const config = {
      get: (key: string) => (key === "share.maxSize" ? 1000 : ""),
    };
    service = new S3FileService(
      prisma as any,
      config as any,
      { t: (key: string) => key } as any,
    );
    send = jest.fn(async () => {
      throw new Error("not a real bucket");
    });
    jest
      .spyOn(service as any, "getS3Instance")
      .mockReturnValue({ send } as never);
  });

  it("refuses a chunk that takes the share over the limit", async () => {
    await expect(upload(500)).rejects.toMatchObject({ status: 413 });
    expect(send).not.toHaveBeenCalled();
  });

  it("uses the reverse share limit over the instance one", async () => {
    share.reverseShare = { maxShareSize: "2000", creator: {} };
    await upload(500).catch(() => undefined);
    expect(send).toHaveBeenCalled();
  });

  it("uses the creator's limit when there is no reverse share", async () => {
    share.creator = { shareSizeLimit: "700" };
    await expect(upload(200)).rejects.toBeInstanceOf(HttpException);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a second file of the same name", async () => {
    share.files = [{ size: "10", name: "a.bin" }];
    await expect(upload(10)).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not add files to a completed share", async () => {
    share.uploadLocked = true;
    await expect(upload(10)).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  // completing the share locks it before the virus scan lists the files, a
  // last chunk already on its way must not finish the object after that
  it("does not finish an object once the share got locked meanwhile", async () => {
    const { CompleteMultipartUploadCommand } =
      await import("@aws-sdk/client-s3");
    send.mockImplementation(async () => ({ UploadId: "up1", ETag: "e1" }));
    const prisma = (service as any).prisma;
    prisma.share.findUnique
      .mockResolvedValueOnce(share)
      .mockResolvedValueOnce({ ...share, uploadLocked: true });

    await expect(upload(10)).rejects.toThrow();
    expect(
      send.mock.calls.some(
        ([command]) => command instanceof CompleteMultipartUploadCommand,
      ),
    ).toBe(false);
  });
});

// Upload state lives in memory per file id. The share limit counted only the
// current file's bytes, and a first chunk sent again left the multipart
// upload it replaced open in the bucket.
describe("S3 uploads in flight", () => {
  const FILE_ID = "6f1c2c4e-8a8b-4f7e-9a51-0b3e6a1d2c3f";
  let send: jest.Mock;
  let service: S3FileService;

  beforeEach(() => {
    const share = {
      id: "s1",
      uploadLocked: false,
      files: [{ size: "600" }],
      creator: null,
      reverseShare: null,
    };
    const prisma = { share: { findUnique: jest.fn(async () => share) } };
    const config = {
      get: (key: string) => (key === "share.maxSize" ? 1000 : ""),
    };
    service = new S3FileService(
      prisma as any,
      config as any,
      { t: (key: string) => key } as any,
    );
    send = jest.fn(async () => ({ UploadId: "new", ETag: "e" }));
    jest
      .spyOn(service as any, "getS3Instance")
      .mockReturnValue({ send } as never);
  });

  const upload = (bytes: number, id = FILE_ID, index = 0, total = 2) =>
    service.create(
      Buffer.alloc(bytes).toString("base64"),
      { index, total },
      { id, name: "b.bin" },
      "s1",
    );

  it("count the share's other uploads against its limit", async () => {
    (service as any).multipartUploads["other-file"] = {
      shareId: "s1",
      uploadId: "u-other",
      parts: [],
      uploadedBytes: 300,
    };
    await expect(upload(200)).rejects.toMatchObject({ status: 413 });
    expect(send).not.toHaveBeenCalled();
  });

  it("abort the upload a resent first chunk replaces", async () => {
    const { AbortMultipartUploadCommand } = await import("@aws-sdk/client-s3");
    (service as any).multipartUploads[FILE_ID] = {
      shareId: "s1",
      uploadId: "u-old",
      parts: [],
      uploadedBytes: 100,
    };
    await upload(10);
    const aborts = send.mock.calls.filter(
      ([command]) => command instanceof AbortMultipartUploadCommand,
    );
    expect(aborts.map(([c]) => c.input.UploadId)).toEqual(["u-old"]);
  });
});
