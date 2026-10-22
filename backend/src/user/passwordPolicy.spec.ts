import { BadRequestException } from "@nestjs/common";
import * as argon from "argon2";
import { AuthService } from "src/auth/auth.service";
import { UserSevice } from "./user.service";

// the totp library is esm only and not needed here
jest.mock("src/auth/authTotp.service", () => ({ AuthTotpService: class {} }));

// The policy lives in config and is checked on the server for every way a
// password gets set. With the custom policy off there is still a minimum of 8.

const OLD = "the old password";

const policyOff = {};
const custom = {
  "security.customPasswordPolicy": true,
  "security.minLength": 12,
  "security.requireUppercase": true,
  "security.requireNumber": true,
};

const build = async (settings: Record<string, unknown>) => {
  const config = {
    get: (key: string) =>
      key === "security.sessionDuration"
        ? { value: 1, unit: "days" }
        : (settings[key] ?? false),
  };
  const user = { id: "u1", email: "anna@example.com", password: "" };
  user.password = await argon.hash(OLD);
  const prisma = {
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
    user: {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(async ({ data }) => ({ id: "u2", ...data })),
      update: jest.fn().mockResolvedValue(user),
      findFirst: jest.fn().mockResolvedValue(user),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: "rt1", token: "refresh" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    resetPasswordToken: { delete: jest.fn().mockResolvedValue({}) },
  };
  const i18n = { t: (key: string) => key };
  const userService = new UserSevice(
    prisma as any,
    {} as any,
    {} as any,
    config as any,
    i18n as any,
  );
  const auth = new AuthService(
    prisma as any,
    { sign: () => "access" } as any,
    config as any,
    {} as any,
    {} as any,
    userService,
    {} as any,
    i18n as any,
    { log: jest.fn() } as any,
  );
  return { auth, userService, prisma, user };
};

const signUp = (auth: AuthService, password: string | null) =>
  auth.signUp(
    { email: "eve@example.com", username: "eve", password } as any,
    "127.0.0.1",
  );

describe("enforcePasswordPolicy", () => {
  it("wants 8 characters when the custom policy is off", async () => {
    const { userService } = await build(policyOff);
    expect(await userService.enforcePasswordPolicy("1234567")).toBe(false);
    expect(await userService.enforcePasswordPolicy("12345678")).toBe(true);
  });

  it("uses the configured rules when the custom policy is on", async () => {
    const { userService } = await build(custom);
    expect(await userService.enforcePasswordPolicy("Abcdefghij1")).toBe(false);
    expect(await userService.enforcePasswordPolicy("abcdefghijk1")).toBe(false);
    expect(await userService.enforcePasswordPolicy("Abcdefghijk1")).toBe(true);
  });

  it("can allow less than 8 when the admin set it so", async () => {
    const { userService } = await build({
      "security.customPasswordPolicy": true,
      "security.minLength": 4,
    });
    expect(await userService.enforcePasswordPolicy("abcd")).toBe(true);
  });
});

describe.each([
  ["policy off", policyOff, "short"],
  ["custom policy", custom, "abcdefghijk1"],
])("with the %s a weak password is refused", (_, settings, weak) => {
  it("on sign up", async () => {
    const { auth, prisma } = await build(settings);
    await expect(signUp(auth, weak)).rejects.toThrow(
      new BadRequestException("auth.passwordPolicyNotMet"),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("on reset", async () => {
    const { auth, prisma } = await build(settings);
    await expect(auth.resetPassword("token", weak)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.resetPasswordToken.delete).not.toHaveBeenCalled();
  });

  it("on change", async () => {
    const { auth, prisma, user } = await build(settings);
    await expect(auth.updatePassword(user as any, weak, OLD)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });

  it("when an admin creates or edits a user", async () => {
    const { userService } = await build(settings);
    await expect(
      userService.create({ email: "e@x.io", password: weak } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(userService.update("u1", { password: weak })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe("passwords that pass", () => {
  it("go through on sign up, reset and change", async () => {
    const { auth, prisma, user } = await build(policyOff);
    await signUp(auth, "long enough");
    await auth.resetPassword("token", "long enough");
    await auth.updatePassword(user as any, "long enough", OLD);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
  });

  it("an oauth sign up without a password is not held to the policy", async () => {
    const { auth, prisma } = await build(custom);
    await signUp(auth, null);
    expect(prisma.user.create.mock.calls[0][0].data.password).toBeNull();
  });

  it("an empty password is still checked, not taken as none", async () => {
    const { userService } = await build(policyOff);
    await expect(userService.update("u1", { password: "" })).rejects.toThrow(
      BadRequestException,
    );
  });
});
