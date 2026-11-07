import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { AuthSignInDTO } from "./authSignIn.dto";

// An empty password never makes it to a password or LDAP check. The LDAP
// service refuses it as well (an empty simple bind is anonymous), this stops
// it at the door.

const passwordErrors = (password: unknown) =>
  validateSync(
    plainToInstance(AuthSignInDTO, { username: "someone", password }),
  ).filter((e) => e.property === "password");

describe("sign in body", () => {
  it("takes a password", () => {
    expect(passwordErrors("secret")).toHaveLength(0);
  });

  it("refuses an empty password", () => {
    expect(passwordErrors("")).toHaveLength(1);
  });
});
