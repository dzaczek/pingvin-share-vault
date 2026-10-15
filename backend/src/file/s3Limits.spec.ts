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

  it("does not add files to a completed share", async () => {
    share.uploadLocked = true;
    await expect(upload(10)).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
});
