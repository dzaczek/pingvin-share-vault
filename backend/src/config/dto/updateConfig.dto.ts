import { IsString, ValidateBy } from "class-validator";

// the type the setting needs is checked by ConfigService, "" and null clear it
const isConfigValue = (value: unknown) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

class UpdateConfigDTO {
  @IsString()
  key: string;

  @ValidateBy({
    name: "isConfigValue",
    validator: {
      validate: isConfigValue,
      defaultMessage: () => "value must be a string, number, boolean or null",
    },
  })
  value: string | number | boolean | null;
}

export default UpdateConfigDTO;
