import * as argon from "argon2";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

// the totp library is esm only and not needed here
jest.mock("./authTotp.service", () => ({ AuthTotpService: class {} }));

// CodeQL treats whatever comes back from a call that mentions a password as a
// password, and followed it into the session cookies. So handing out tokens
// is kept apart from anything that handles a password: the login is audited
// on the side, and changing a password returns nothing. These pin down that
// the behaviour stayed the same.

const PASSWORD = "correct horse battery";

const build = async (user: Record<string, unknown>) => {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: "u1",
        email: "someone@example.com",
        isActivated: true,
        password: await argon.hash(PASSWORD),
        ...user,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: "rt1", token: "refresh" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    loginToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ token: "login" }),
    },
  };
  const config = {
    get: (key: string) =>
      key === "security.sessionDuration"
        ? { value: 1, unit: "days" }
        : key === "internal.jwtSecret"
          ? "secret"
          : false,
  };
  const auditLog = { log: jest.fn() };
  const unused = {} as any;
  const service = new AuthService(
    prisma as any,
    { sign: () => "access" } as any,
    config as any,
    unused,
    unused,
    unused,
    unused,
    { t: (key: string) => key } as any,
    auditLog as any,
  );
  return { service, prisma, auditLog };
};

describe("signing in with a password", () => {
  it("hands out both tokens and audits the login", async () => {
    const { service, auditLog } = await build({});

    const result = await service.signIn(
      { username: "someone", password: PASSWORD } as any,
      "127.0.0.1",
    );

    expect(result).toEqual({ accessToken: "access", refreshToken: "refresh" });
    expect(auditLog.log).toHaveBeenCalledWith("AUTH_LOGIN_SUCCESS", {
      userId: "u1",
      userEmail: "someone@example.com",
      metadata: { method: "password", provider: undefined },
    });
  });

  it("only hands out a login token when totp is on", async () => {
    const { service, auditLog } = await build({ totpVerified: true });

    const result = await service.signIn(
      { username: "someone", password: PASSWORD } as any,
      "127.0.0.1",
    );

    expect(result).toEqual({ loginToken: "login" });
    expect(auditLog.log).toHaveBeenCalledWith(
      "AUTH_LOGIN_TOTP_REQUIRED",
      expect.objectContaining({
        metadata: expect.objectContaining({ method: "password" }),
      }),
    );
  });
});

describe("changing a password", () => {
  it("stores the new hash, ends every session and returns nothing", async () => {
    const { service, prisma } = await build({});
    const user = await prisma.user.findFirst();

    const result = await service.updatePassword(user, "a new one", PASSWORD);

    expect(result).toBeUndefined();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    const hash = prisma.user.update.mock.calls[0][0].data.password;
    expect(await argon.verify(hash, "a new one")).toBe(true);
  });

  it("starts a new session in the cookie", async () => {
    const authService = {
      updatePassword: jest.fn().mockResolvedValue(undefined),
      createRefreshToken: jest
        .fn()
        .mockResolvedValue({ refreshToken: "refresh", refreshTokenId: "rt1" }),
      addTokensToResponse: jest.fn(),
    };
    const controller = new AuthController(
      authService as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const response = {};

    const body = await controller.updatePassword(
      { id: "u1" } as any,
      response as any,
      { password: "a new one", oldPassword: PASSWORD } as any,
    );

    expect(authService.createRefreshToken).toHaveBeenCalledWith("u1");
    expect(authService.addTokensToResponse).toHaveBeenCalledWith(
      response,
      "refresh",
    );
    expect(body).toEqual(expect.objectContaining({ refreshToken: "refresh" }));
  });
});
