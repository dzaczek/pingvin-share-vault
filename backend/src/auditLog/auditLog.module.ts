import { Global, Module } from "@nestjs/common";
import { AuditLogController } from "./auditLog.controller";
import { AuditLogService } from "./auditLog.service";

// global because auth, oauth, file and share all write to it
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
