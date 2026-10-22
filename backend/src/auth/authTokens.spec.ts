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
      findFirst: jest.fn().mockResolvedValue({ id: "rt1" }),
    },
    resetPasswordToken: {
      delete: jest.fn().mockResolvedValue({}),
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
  const jwt = {
    sign: () => "access",
    verifyAsync: jest
      .fn()
      .mockResolvedValue({ sub: "u1", refreshTokenId: "rt1" }),
  };
  const userService = { enforcePasswordPolicy: async () => true };
  const unused = {} as any;
  const service = new AuthService(
    prisma as any,
    jwt as any,
    config as any,
    unused,
    unused,
    userService as any,
    unused,
    { t: (key: string) => key } as any,
    auditLog as any,
  );
  return { service, prisma, auditLog, jwt };
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
      createAccessToken: jest.fn().mockResolvedValue("access"),
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
    expect(authService.createAccessToken).toHaveBeenCalledWith(
      { id: "u1" },
      "rt1",
    );
    // the old access token named a session that is gone now, it has to be
    // replaced too or the next request is refused
    expect(authService.addTokensToResponse).toHaveBeenCalledWith(
      response,
      "refresh",
      "access",
    );
    expect(body).toEqual({ accessToken: "access", refreshToken: "refresh" });
  });
});

describe("resetting a password", () => {
  it("ends every session of the user", async () => {
    const { service, prisma } = await build({});

    await service.resetPassword("reset-token", "a new password");

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });
});

describe("getIdOfCurrentUser", () => {
  const request = { cookies: { access_token: "access" } } as any;

  it("returns the id while the session lives", async () => {
    const { service, prisma } = await build({});

    expect(await service.getIdOfCurrentUser(request)).toBe("u1");
    expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith({
      where: { id: "rt1", userId: "u1", expiresAt: { gt: expect.any(Date) } },
    });
  });

  it("returns null once the session was revoked", async () => {
    const { service, prisma } = await build({});
    prisma.refreshToken.findFirst.mockResolvedValue(null);

    expect(await service.getIdOfCurrentUser(request)).toBeNull();
  });

  it("returns null for a token that names no session", async () => {
    const { service, prisma, jwt } = await build({});
    jwt.verifyAsync.mockResolvedValue({ sub: "u1" });

    expect(await service.getIdOfCurrentUser(request)).toBeNull();
    expect(prisma.refreshToken.findFirst).not.toHaveBeenCalled();
  });
});
