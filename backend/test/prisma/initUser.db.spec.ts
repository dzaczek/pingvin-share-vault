import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ConfigService } from "../../src/config/config.service";
import { DB_URL } from "./setup";

jest.mock("src/constants", () => ({
  get CONFIG_FILE() {
    return configFile;
  },
}));

// initUser in config.yaml creates the first administrator. It runs on every
// start, so it has to leave an instance that already has accounts alone
// instead of stopping the startup on a duplicate email.

let configFile = "";
let prisma: PrismaClient;

const initUserYaml = `initUser:
  enabled: true
  username: initadmin
  email: initadmin@example.invalid
  password: InitPassword123!
  isAdmin: true
`;

const start = () => new ConfigService([], prisma as any).initialize();

const makeUser = (name: string, isAdmin: boolean) =>
  prisma.user.create({
    data: { username: name, email: `${name}@example.invalid`, isAdmin },
  });

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: DB_URL }),
  });
  await prisma.$connect();
  configFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "pingvin-inituser-")),
    "config.yaml",
  );
  fs.writeFileSync(configFile, initUserYaml);
});

beforeEach(() => prisma.user.deleteMany());

afterAll(async () => {
  fs.rmSync(path.dirname(configFile), { recursive: true, force: true });
  await prisma.$disconnect();
});

describe("initUser", () => {
  it("creates the administrator on an empty database", async () => {
    await start();
    const user = await prisma.user.findUnique({
      where: { email: "initadmin@example.invalid" },
    });
    expect(user?.isAdmin).toBe(true);
  });

  it("starts again after it created the account", async () => {
    await start();
    await expect(start()).resolves.toBeUndefined();
    expect(await prisma.user.count()).toBe(1);
  });

  it("leaves an instance with two administrators alone", async () => {
    await makeUser("first_admin", true);
    await makeUser("second_admin", true);
    await expect(start()).resolves.toBeUndefined();
    expect(await prisma.user.count()).toBe(2);
  });

  it("does not bring back the account once an admin exists", async () => {
    await makeUser("other_admin", true);
    await expect(start()).resolves.toBeUndefined();
    expect(
      await prisma.user.count({ where: { email: "initadmin@example.invalid" } }),
    ).toBe(0);
  });

  it("does not trip over an existing account with the same email", async () => {
    await prisma.user.create({
      data: { username: "someone", email: "initadmin@example.invalid" },
    });
    await expect(start()).resolves.toBeUndefined();
    expect(await prisma.user.count()).toBe(1);
  });
});
