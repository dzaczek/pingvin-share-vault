import { passwordSchema, resolvePasswordPolicy } from "./passwordPolicy.util";

const config = (values: Record<string, any>) => (key: string) => values[key];

describe("resolvePasswordPolicy", () => {
  it("reads every requirement from config when the policy is on", () => {
    expect(
      resolvePasswordPolicy(
        config({
          "security.customPasswordPolicy": true,
          "security.minLength": 14,
          "security.requireUppercase": true,
          "security.requireLowercase": true,
          "security.requireNumber": true,
          "security.requireSpecialCharacter": false,
        }),
      ),
    ).toEqual({
      minLength: 14,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialCharacter: false,
    });
  });

  // the part that is easy to get wrong: switching the policy off has to ignore
  // the individual settings rather than quietly keep enforcing them
  it("ignores the requirements entirely when the policy is off", () => {
    expect(
      resolvePasswordPolicy(
        config({
          "security.customPasswordPolicy": false,
          "security.minLength": 32,
          "security.requireUppercase": true,
          "security.requireLowercase": true,
          "security.requireNumber": true,
          "security.requireSpecialCharacter": true,
        }),
      ),
    ).toEqual({
      minLength: 8,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSpecialCharacter: false,
    });
  });

  it("hands back a fresh object, so a caller cannot alter the fallback", () => {
    const off = config({ "security.customPasswordPolicy": false });
    const first = resolvePasswordPolicy(off);
    first.minLength = 99;

    expect(resolvePasswordPolicy(off).minLength).toBe(8);
  });
});

describe("passwordSchema", () => {
  const t = (id: string) => id;
  const error = (policy: Parameters<typeof passwordSchema>[0], value: string) =>
    passwordSchema(policy, t)
      .validate(value)
      .then(() => null)
      .catch((e) => e.message);

  it("wants 8 characters and nothing else with the policy off", async () => {
    const off = resolvePasswordPolicy(config({}));
    expect(await error(off, "1234567")).toBe("common.error.too-short");
    expect(await error(off, "12345678")).toBeNull();
  });

  it("follows a custom policy, also below 8", async () => {
    const policy = resolvePasswordPolicy(
      config({
        "security.customPasswordPolicy": true,
        "security.minLength": 4,
        "security.requireUppercase": true,
        "security.requireSpecialCharacter": true,
      }),
    );
    expect(await error(policy, "abc!")).toBe("common.error.password.uppercase");
    expect(await error(policy, "Abcd")).toBe("common.error.password.special");
    expect(await error(policy, "Ab!")).toBe("common.error.too-short");
    expect(await error(policy, "Abc!")).toBeNull();
  });
});
