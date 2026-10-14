import { Module } from "@nestjs/common";
import { WallpaperController } from "./wallpaper.controller";
import { WallpaperService } from "./wallpaper.service";

@Module({
  controllers: [WallpaperController],
  providers: [WallpaperService],
})
export class WallpaperModule {}
