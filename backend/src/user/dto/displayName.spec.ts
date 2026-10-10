import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { AuthRegisterDTO } from "src/auth/dto/authRegister.dto";
import { UpdateOwnUserDTO } from "./updateOwnUser.dto";

// The display name is typed in by the user and then shows up in mails sent
// to other people, so it has to stay a plain name.

const errorsFor = (dto: any, displayName: string) =>
  validateSync(plainToInstance(dto, { displayName }), {
    skipMissingProperties: true,
  }).filter((e) => e.property === "displayName");

describe.each([
  ["sign up", AuthRegisterDTO],
  ["own account", UpdateOwnUserDTO],
])("display name on %s", (_, dto) => {
  it.each(["Jacek Załęski", "O'Neil-Smith", "Dr. Anna, MSc", "Łukasz Żółć", ""])(
    "accepts %j",
    (name) => {
      expect(errorsFor(dto, name)).toHaveLength(0);
    },
  );

  it.each([
    "<b>admin</b>",
    "Jacek\nBcc: someone@example.com",
    "{password}",
    "x".repeat(65),
  ])("refuses %j", (name) => {
    expect(errorsFor(dto, name)).not.toHaveLength(0);
  });
});
