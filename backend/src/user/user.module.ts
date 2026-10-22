import { Module } from "@nestjs/common";
import { EmailModule } from "src/email/email.module";
import { UserController } from "./user.controller";
import { UserSevice } from "./user.service";
import { UserOverviewService } from "./userOverview.service";
import { FileModule } from "src/file/file.module";

@Module({
  imports: [EmailModule, FileModule],
  providers: [UserSevice, UserOverviewService],
  controllers: [UserController],
  exports: [UserSevice],
})
export class UserModule {}
