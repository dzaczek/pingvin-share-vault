import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { createReadStream } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import * as rangeParser from "range-parser";
import { ConfigService } from "src/config/config.service";
import { DATA_DIRECTORY } from "src/constants";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require("sharp");

export const WALLPAPER_DIRECTORY = `${DATA_DIRECTORY}/wallpapers`;
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 60 * 1024 * 1024;

const MIME_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

// random ids only, so a name from the request can never point elsewhere
const FILE_NAME = /^[A-Za-z0-9_-]{16}(\.thumb)?\.(jpg|png|webp|mp4|webm)$/;

const ROOT = path.resolve(WALLPAPER_DIRECTORY);

// the name is checked above, this keeps the resolved path inside the
// directory as well, should the pattern ever be loosened
const inDirectory = (name: string) => {
  const resolved = path.resolve(ROOT, name);
  if (!resolved.startsWith(ROOT + path.sep))
    throw new NotFoundException("Wallpaper not found");
  return resolved;
};

export type Wallpaper = {
  file: string;
  name: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  size: number;
  createdAt: string;
  url: string;
  thumbnailUrl?: string;
};

@Injectable()
export class WallpaperService {
  constructor(private config: ConfigService) {}

  async list(): Promise<Wallpaper[]> {
    const files = await fs.readdir(WALLPAPER_DIRECTORY).catch(() => []);
    const wallpapers = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) =>
          JSON.parse(await fs.readFile(inDirectory(file), "utf8")),
        ),
    );
    return wallpapers
      .map((wallpaper) => this.withUrls(wallpaper))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async upload(file: Express.Multer.File): Promise<Wallpaper> {
    if (!file?.buffer?.length)
      throw new BadRequestException("No file was uploaded");

    const { kind, extension, width, height } = await this.inspect(file.buffer);
    if (file.size > (kind === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE))
      throw new BadRequestException(
        `The file is too large, ${kind === "image" ? 20 : 60} MB at most`,
      );

    const id = randomBytes(12).toString("base64url");
    const stored = `${id}.${extension}`;
    await fs.mkdir(WALLPAPER_DIRECTORY, { recursive: true });
    await fs.writeFile(inDirectory(stored), file.buffer);

    // the gallery shows a small copy instead of a picture of many megabytes
    if (kind === "image")
      await sharp(file.buffer)
        .rotate()
        .resize(640)
        .webp({ quality: 75 })
        .toFile(inDirectory(`${id}.thumb.webp`));

    const wallpaper = {
      file: stored,
      name: (file.originalname || stored).slice(0, 120),
      kind,
      width,
      height,
      size: file.size,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(inDirectory(`${id}.json`), JSON.stringify(wallpaper));
    return this.withUrls(wallpaper);
  }

  async remove(file: string) {
    if (!FILE_NAME.test(file) || file.includes(".thumb."))
      throw new NotFoundException("Wallpaper not found");

    const id = file.split(".")[0];
    const metadata = inDirectory(`${id}.json`);
    if (!(await this.exists(metadata)))
      throw new NotFoundException("Wallpaper not found");

    for (const target of [
      inDirectory(file),
      inDirectory(`${id}.thumb.webp`),
      metadata,
    ])
      await fs.rm(target, { force: true });

    // a deleted wallpaper in use would leave the page on a broken address
    if (this.config.get("appearance.glassBackgroundUrl") === this.url(file))
      await this.config
        .update("appearance.glassBackgroundUrl", "")
        .catch(() => undefined);
  }

  async get(file: string, range?: string) {
    if (!FILE_NAME.test(file))
      throw new NotFoundException("Wallpaper not found");

    const target = inDirectory(file);
    const stat = await fs.stat(target).catch(() => {
      throw new NotFoundException("Wallpaper not found");
    });

    const size = stat.size;
    let part: { start: number; end: number } | undefined;
    if (range) {
      const ranges = rangeParser(size, range, { combine: true });
      if (ranges === -1) return { size, unsatisfiable: true as const };
      if (Array.isArray(ranges) && ranges.length > 0) part = ranges[0];
    }

    return {
      size,
      part,
      mimeType: MIME_TYPES[file.split(".").pop() as keyof typeof MIME_TYPES],
      stream: createReadStream(target, part),
    };
  }

  // decided from the bytes, not from the name or the type the browser sent
  private async inspect(buffer: Buffer) {
    if (buffer.subarray(4, 8).toString("latin1") === "ftyp")
      return { kind: "video" as const, extension: "mp4" };
    if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
      return { kind: "video" as const, extension: "webm" };

    const metadata = await sharp(buffer)
      .metadata()
      .catch(() => undefined);
    const extension = { jpeg: "jpg", png: "png", webp: "webp" }[
      metadata?.format as string
    ];
    if (!extension)
      throw new BadRequestException(
        "Only JPG, PNG and WebP images or MP4 and WebM videos can be used",
      );

    // phone photos store the turn in exif, the browser applies it
    const turned = (metadata.orientation ?? 1) >= 5;
    return {
      kind: "image" as const,
      extension,
      width: turned ? metadata.height : metadata.width,
      height: turned ? metadata.width : metadata.height,
    };
  }

  private url(file: string) {
    return `/api/wallpapers/${file}`;
  }

  private withUrls(wallpaper: Omit<Wallpaper, "url">): Wallpaper {
    return {
      ...wallpaper,
      url: this.url(wallpaper.file),
      thumbnailUrl:
        wallpaper.kind === "image"
          ? this.url(`${wallpaper.file.split(".")[0]}.thumb.webp`)
          : undefined,
    };
  }

  private exists(target: string) {
    return fs
      .access(target)
      .then(() => true)
      .catch(() => false);
  }
}
