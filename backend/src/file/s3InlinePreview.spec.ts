import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3FileService } from "./s3.service";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async (_client, command) => command),
}));

// A local preview gets the file's type, nosniff and a CSP sandbox. An S3
// preview was a redirect asking the bucket for inline display with whatever
// type the bucket picked, so an uploaded .html or .svg could run as a page.

describe("S3 preview links", () => {
  const link = async (name: string, isDownload = false) => {
    const prisma = {
      file: { findFirst: jest.fn(async () => ({ id: "f1", name })) },
    };
    const service = new S3FileService(
      prisma as any,
      { get: () => "" } as any,
      { t: (key: string) => key } as any,
    );
    jest.spyOn(service, "getS3Instance").mockReturnValue({} as never);
    const command = (await service.getPreSignedDownloadUrl(
      "s1",
      "f1",
      isDownload,
    )) as unknown as GetObjectCommand;
    return command.input;
  };

  it("shows passive media and PDFs inline with their own type", async () => {
    const image = await link("photo.png");
    expect(image.ResponseContentType).toBe("image/png");
    expect(image.ResponseContentDisposition).toMatch(/^inline/);

    const pdf = await link("report.pdf");
    expect(pdf.ResponseContentType).toBe("application/pdf");
    expect(pdf.ResponseContentDisposition).toMatch(/^inline/);
  });

  it("never shows active content inline", async () => {
    for (const name of ["page.html", "drawing.svg", "data.xml", "noext"]) {
      const input = await link(name);
      expect(input.ResponseContentDisposition).toMatch(/^attachment/);
      expect(input.ResponseContentType).toBeDefined();
    }
  });

  it("keeps a download a download", async () => {
    const input = await link("photo.png", true);
    expect(input.ResponseContentDisposition).toMatch(/^attachment/);
  });
});
