import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { AuditLogService } from "./auditLog.service";
import { AuditLogQueryDTO } from "./dto/auditLogQuery.dto";

@Controller("auditLogs")
@UseGuards(JwtGuard, AdministratorGuard)
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get()
  async list(@Query() query: AuditLogQueryDTO) {
    return this.auditLogService.find(query);
  }

  @Get("shards")
  async shards() {
    return this.auditLogService.shardSummary();
  }
}
