import { User } from "@prisma/client";
import * as argon from "argon2";
import { AuthService } from "src/auth/auth.service";
import { UserSevice } from "./user.service";

jest.mock("src/auth/authTotp.service", () => ({ AuthTotpService: class {} }));

// With only a stolen session, PATCH /users/me could move the account to the
// attacker's address, a password reset sent there then set a new password,
// skipping the old password check that PATCH /auth/password asks for.

describe("changing the email address", () => {
  let current: User;
  let prisma: any;
  let service: UserSevice;

  beforeEach(async () => {
    current = {
      id: "u1",
      email: "anna@example.com",
      username: "anna",
      password: await argon.hash("anna's password"),
    } as User;
    prisma = {
      user: { update: jest.fn(async ({ data }) => ({ ...current, ...data })) },
    };
    service = new UserSevice(
      prisma,
      { sendVerificationEmail: jest.fn() } as any,
      {} as any,
      { get: () => false } as any,
      { t: (key: string) => key } as any,
    );
  });

  it("needs the current password", async () => {
    await expect(
      service.updateOwn(current, { email: "eve@example.com" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.updateOwn(current, {
        email: "eve@example.com",
        currentPassword: "a guess",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("goes through with it, and never stores it as the new password", async () => {
    await service.updateOwn(current, {
      email: "eve@example.com",
      currentPassword: "anna's password",
    });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.email).toBe("eve@example.com");
    expect(data.password).toBeUndefined();
  });

  it("does not ask for it when the address stays the same", async () => {
    await service.updateOwn(current, {
      email: "Anna@example.com",
      displayName: "Anna",
    });
    expect(prisma.user.update).toHaveBeenCalled();
  });
});

describe("password reset to an address not confirmed yet", () => {
  it("sends nothing", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => ({
          id: "u1",
          email: "eve@example.com",
          isActivated: true,
          activationToken: "pending",
          resetPasswordToken: null,
        })),
      },
      $transaction: jest.fn(),
    };
    const mail = { sendResetPasswordEmail: jest.fn() };
    const config = {
      get: (key: string) => key === "security.enableEmailVerification",
    };
    const auth = new AuthService(
      prisma as any,
      {} as any,
      config as any,
      mail as any,
      {} as any,
      {} as any,
      {} as any,
      { t: (key: string) => key } as any,
      {} as any,
    );

    await auth.requestResetPassword("eve@example.com");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mail.sendResetPasswordEmail).not.toHaveBeenCalled();
  });
});
