import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SkipThrottle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { DemoModeGuard } from "src/auth/guard/demoMode.guard";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { MAX_VIDEO_SIZE, WallpaperService } from "./wallpaper.service";

@Controller("wallpapers")
export class WallpaperController {
  constructor(private wallpaperService: WallpaperService) {}

  @Get()
  @UseGuards(JwtGuard, AdministratorGuard)
  async list() {
    return await this.wallpaperService.list();
  }

  @Post()
  @UseGuards(JwtGuard, AdministratorGuard, DemoModeGuard)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_VIDEO_SIZE } }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    return await this.wallpaperService.upload(file);
  }

  // every page in Glass loads it, so it is public, cached for good (the name
  // never changes) and left out of the rate limit and the audit log
  @Get(":file")
  @SkipThrottle()
  async get(
    @Param("file") file: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const wallpaper = await this.wallpaperService.get(file, req.headers.range);

    if ("unsatisfiable" in wallpaper) {
      res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
      res.set("Content-Range", `bytes */${wallpaper.size}`);
      return;
    }

    const { size, part, mimeType, stream } = wallpaper;
    res.set({
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": part ? part.end - part.start + 1 : size,
    });
    if (part) {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.set("Content-Range", `bytes ${part.start}-${part.end}/${size}`);
    }
    return new StreamableFile(stream);
  }

  @Delete(":file")
  @UseGuards(JwtGuard, AdministratorGuard, DemoModeGuard)
  async remove(@Param("file") file: string) {
    await this.wallpaperService.remove(file);
  }
}
