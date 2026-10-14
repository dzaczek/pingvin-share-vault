import { BadRequestException, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wallpapers-"));
jest.mock("src/constants", () => ({ DATA_DIRECTORY: dataDirectory }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require("sharp");
import { WallpaperService } from "./wallpaper.service";

// Wallpapers are uploaded by the admin and then served to everyone, so the
// type is taken from the bytes and only names the service made up itself
// are ever opened.

const config = {
  get: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};
const service = new WallpaperService(config as any);

const upload = (buffer: Buffer, originalname = "upload") =>
  service.upload({ buffer, size: buffer.length, originalname } as any);

const png = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: "#4c6ef5" },
  })
    .png()
    .toBuffer();

afterAll(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));

describe("WallpaperService", () => {
  it("keeps an image with its size and a small copy for the gallery", async () => {
    const wallpaper = await upload(await png(3840, 2160), "sea.png");

    expect(wallpaper).toMatchObject({
      kind: "image",
      name: "sea.png",
      width: 3840,
      height: 2160,
    });
    expect(wallpaper.url).toMatch(/^\/api\/wallpapers\/[\w-]{16}\.png$/);
    expect(wallpaper.thumbnailUrl).toMatch(/\.thumb\.webp$/);
    expect((await service.list()).map((w) => w.file)).toContain(wallpaper.file);
  });

  it("recognizes a video from its header", async () => {
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from("ftypisom"),
      Buffer.alloc(64),
    ]);
    expect(await upload(mp4, "loop.mov")).toMatchObject({
      kind: "video",
      file: expect.stringMatching(/\.mp4$/),
    });
  });

  it("refuses anything else, whatever the name says", async () => {
    await expect(
      upload(Buffer.from("<svg onload=alert(1)>"), "x.png"),
    ).rejects.toThrow(BadRequestException);
  });

  it("serves a part of a file for a range request", async () => {
    const { file } = await upload(await png(10, 10));
    const result = await service.get(file, "bytes=0-9");
    expect(result).toMatchObject({ part: { start: 0, end: 9 } });
    if ("stream" in result) result.stream.destroy();
  });

  it("opens no path that came in from the request", async () => {
    for (const name of ["../../etc/passwd", "x.json", "short.png"])
      await expect(service.get(name)).rejects.toThrow(NotFoundException);
  });

  it("clears the setting when the wallpaper in use is deleted", async () => {
    const { file, url } = await upload(await png(10, 10));
    config.get.mockReturnValue(url);

    await service.remove(file);

    expect(config.update).toHaveBeenCalledWith(
      "appearance.glassBackgroundUrl",
      "",
    );
    expect((await service.list()).map((w) => w.file)).not.toContain(file);
    await expect(service.get(file)).rejects.toThrow(NotFoundException);
  });
});
