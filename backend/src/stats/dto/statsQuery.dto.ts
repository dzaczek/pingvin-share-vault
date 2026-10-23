import { IsIn, IsOptional } from "class-validator";

export class StatsQueryDTO {
  // the pipe validates but does not transform, so this stays a string
  @IsOptional()
  @IsIn(["7", "30", "90"])
  days?: string;
}
