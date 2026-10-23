import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { StatsQueryDTO } from "./dto/statsQuery.dto";
import { StatsService } from "./stats.service";

@Controller("stats")
@UseGuards(JwtGuard, AdministratorGuard)
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get()
  async get(@Query() query: StatsQueryDTO) {
    return this.statsService.get(Number(query.days ?? 30));
  }
}
