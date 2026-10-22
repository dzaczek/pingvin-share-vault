import { BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import * as argon from "argon2";
import { AuthService } from "../../src/auth/auth.service";
import { DB_URL } from "./setup";

// Two account rules that only show up against a real database: who becomes
// admin on a fresh install, and how long a password reset link stays good.

let prisma: PrismaClient;
let service: AuthService;

const unused = {} as any;

const config = {
  get: (key: string) =>
    ({
      "security.enableEmailVerification": false,
      "security.sessionDuration": { value: 1, unit: "days" },
      "internal.jwtSecret": "test-secret",
      "oauth.disablePassword": false,
    })[key],
} as any;

const i18n = { t: (key: string) => key } as any;

const makeUser = async () => {
  const n = `acc-${Math.random().toString(36).slice(2, 10)}`;
  return prisma.user.create({
    data: {
      username: n,
      email: `${n}@example.invalid`,
      password: await argon.hash("old password"),
    },
  });
};

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: DB_URL }),
  });
  await prisma.$connect();

  service = new AuthService(
    prisma as any,
    new JwtService(),
    config,
    unused,
    unused,
    { enforcePasswordPolicy: async (p: string) => p.length >= 8 } as any,
    unused,
    i18n,
    unused,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("signUp on a fresh install", () => {
  it("makes only one of two simultaneous sign ups an admin", async () => {
    // the file is shared with the other db specs, so start from no users
    await prisma.user.deleteMany();

    const signUp = (n: string) =>
      service.signUp(
        { email: `${n}@example.invalid`, username: n, password: "Password123!" },
        "127.0.0.1",
      );
    await Promise.all([signUp("first_a"), signUp("first_b")]);

    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.user.count({ where: { isAdmin: true } })).toBe(1);
  });
});

describe("resetPassword", () => {
  it("accepts a token that has not expired", async () => {
    const user = await makeUser();
    const { token } = await prisma.resetPasswordToken.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) },
    });

    await service.resetPassword(token, "new password");

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(await argon.verify(after!.password!, "new password")).toBe(true);
  });

  it("refuses a token that has expired", async () => {
    const user = await makeUser();
    const { token } = await prisma.resetPasswordToken.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(service.resetPassword(token, "new password")).rejects.toThrow(
      BadRequestException,
    );

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(await argon.verify(after!.password!, "old password")).toBe(true);
  });
});
