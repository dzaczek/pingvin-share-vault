import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ShareService } from "./share.service";

jest.mock("../constants", () => ({
  get SHARE_DIRECTORY() {
    return root;
  },
}));

// The client picks the share id and create reused whatever folder was at it.
// A share deleted with its reverse share's owner left its files and zip
// behind, and on a case-insensitive disk "Report" and "report" are one
// folder, so a new share could read or wipe another share's files.

let root = "";

const service = (prisma: unknown) => {
  const unused = {} as any;
  const config = {
    get: (key: string) =>
      key === "share.maxExpiration" ? { value: 0, unit: "days" } : undefined,
  };
  return new ShareService(
    prisma as any,
    config as any,
    unused,
    unused,
    config as any,
    unused,
    { isValid: async () => false } as any,
    unused,
    unused,
    { log: jest.fn() } as any,
    { t: (key: string) => key } as any,
    unused,
  );
};

describe("a share id whose folder already exists", () => {
  let prisma: any;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "share-reuse-"));
    prisma = {
      share: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => ({ id: "s1", ...data })),
      },
    };
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const create = (id: string) =>
    service(prisma).create(
      { id, expiration: "never" } as any,
      { id: "u1", isAdmin: true } as any,
    );

  it("is not handed out again", async () => {
    fs.mkdirSync(path.join(root, "left-behind"));
    fs.writeFileSync(path.join(root, "left-behind", "archive.zip"), "old");

    await expect(create("left-behind")).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.share.create).not.toHaveBeenCalled();
    expect(
      await service(prisma).isShareIdAvailable("left-behind"),
    ).toEqual({ isAvailable: false });
  });

  it("is still free when nothing is there", async () => {
    expect(await service(prisma).isShareIdAvailable("fresh")).toEqual({
      isAvailable: true,
    });
    await create("fresh");
    expect(prisma.share.create).toHaveBeenCalled();
  });
});
