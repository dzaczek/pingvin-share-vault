import { PartialType, PickType } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { UserDTO } from "./user.dto";

export class UpdateOwnUserDTO extends PartialType(
  PickType(UserDTO, ["displayName", "username", "email"] as const),
) {
  // asked for when the address changes, it is where password resets go
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
