import { User } from "@prisma/client";
import { UserSevice } from "./user.service";

describe("UserSevice.updateOwn", () => {
  const current = { id: "u1", email: "anna@example.com" } as User;
  let verification: boolean;
  let prisma: any;
  let email: any;
  let service: UserSevice;

  beforeEach(() => {
    verification = true;
    prisma = {
      user: {
        update: jest.fn(async ({ data }) => ({
          ...current,
          username: "anna",
          ...data,
        })),
      },
    };
    email = { sendVerificationEmail: jest.fn() };
    const config = { get: () => verification };
    service = new UserSevice(
      prisma,
      email,
      {} as any,
      config as any,
      { t: (key: string) => key } as any,
    );
  });

  const saved = () => prisma.user.update.mock.calls[0][0].data;

  it("stores the address the way sign up does", async () => {
    verification = false;
    await service.updateOwn(current, { email: " Eve@Example.COM " });
    expect(saved().email).toBe("eve@example.com");
    expect(saved().activationToken).toBeUndefined();
  });

  it("asks to confirm a changed address in the same write", async () => {
    await service.updateOwn(current, { email: "eve@example.com" });
    expect(saved().activationToken).toEqual(expect.any(String));
    expect(email.sendVerificationEmail).toHaveBeenCalledWith(
      "eve@example.com",
      saved().activationToken,
      "anna",
    );
  });

  it("leaves an unchanged address alone", async () => {
    await service.updateOwn(current, {
      email: "Anna@example.com",
      displayName: "Anna",
    });
    expect(saved().activationToken).toBeUndefined();
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("UserSevice.update errors", () => {
  it("passes on errors other than a duplicate", async () => {
    const prisma = {
      user: { update: jest.fn().mockRejectedValue(new Error("db down")) },
    };
    const service = new UserSevice(
      prisma as any,
      {} as any,
      {} as any,
      { get: () => false } as any,
      { t: (key: string) => key } as any,
    );
    await expect(service.update("u1", { displayName: "A" })).rejects.toThrow(
      "db down",
    );
  });
});

describe("UserSevice.update sessions", () => {
  const build = () => {
    const prisma = {
      user: { update: jest.fn().mockResolvedValue({ id: "u1" }) },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new UserSevice(
      prisma as any,
      {} as any,
      {} as any,
      { get: () => false } as any,
      { t: (key: string) => key } as any,
    );
    return { service, prisma };
  };

  it("signs the user out everywhere when an admin sets a new password", async () => {
    const { service, prisma } = build();
    await service.update("u1", { password: "a new password" });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });

  it("keeps the sessions on any other edit", async () => {
    const { service, prisma } = build();
    await service.update("u1", { displayName: "Anna" });
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });
});
