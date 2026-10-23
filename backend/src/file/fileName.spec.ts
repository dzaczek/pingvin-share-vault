import { BadRequestException } from "@nestjs/common";
import { FileService } from "./file.service";

// The S3 key of a file is "<share>/<name>", so the name an uploader sends
// must reach the storage already cleaned, for both the chunked upload and
// the direct to S3 one. A name with nothing left is refused.

const construct = (local: unknown, s3: unknown, provider = "LOCAL") => {
  const unused = {} as any;
  const prisma = {
    share: {
      findUnique: async () => null,
      findFirst: async () => ({ storageProvider: provider }),
    },
  };
  return new FileService(
    prisma as any,
    local as any,
    s3 as any,
    { get: () => provider === "S3" } as any,
    unused,
    { t: (key: string) => key } as any,
    unused,
    unused,
  );
};

const firstChunk = { index: 0, total: 2 };

describe("file names on upload", () => {
  it("hands the storage a name that stays inside the share", async () => {
    const create = jest.fn(async (_d, _c, file) => ({ id: "f", ...file }));
    const service = construct({ create }, {});

    await service.create("", firstChunk, { name: "../other/x.txt" }, "share");

    expect(create.mock.calls[0][2].name).toBe("other/x.txt");
  });

  it("keeps the folders of a folder upload", async () => {
    const create = jest.fn(async (_d, _c, file) => ({ id: "f", ...file }));
    const service = construct({ create }, {});

    await service.create("", firstChunk, { name: "photos/a.jpg" }, "share");

    expect(create.mock.calls[0][2].name).toBe("photos/a.jpg");
  });

  it("refuses a name made of dots only", async () => {
    const create = jest.fn();
    const service = construct({ create }, {});

    await expect(
      service.create("", firstChunk, { name: "../.." }, "share"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("cleans the name of a direct S3 upload too", async () => {
    const s3 = {
      createPreSignedUploadUrls: jest.fn(async (..._args: unknown[]) => ({})),
      completePreSignedUpload: jest.fn(async (..._args: unknown[]) => ({
        id: "f",
      })),
      abortPreSignedUpload: jest.fn(async (..._args: unknown[]) => undefined),
    };
    const service = construct({}, s3, "S3");
    jest.spyOn(service as any, "auditUpload").mockResolvedValue(undefined);

    await service.createPreSignedUploadUrls("share", "../b/x.bin", 1);
    await service.completePreSignedUpload("share", "f", "../b/x.bin", "u", []);
    await service.abortPreSignedUpload("share", "../b/x.bin", "u");

    expect(s3.createPreSignedUploadUrls.mock.calls[0][1]).toBe("b/x.bin");
    expect(s3.completePreSignedUpload.mock.calls[0][2]).toBe("b/x.bin");
    expect(s3.abortPreSignedUpload.mock.calls[0][1]).toBe("b/x.bin");
  });
});
