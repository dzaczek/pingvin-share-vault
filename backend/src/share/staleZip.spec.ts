import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ShareService } from "./share.service";

jest.mock("../constants", () => ({
  get SHARE_DIRECTORY() {
    return root;
  },
}));

// Reopening a completed share left its prebuilt archive.zip on disk. Files
// removed afterwards stayed downloadable through "download all", and with a
// single file left the zip was never rebuilt.

const SHARE_ID = "stale-zip-share";
let root = "";

const construct = (prisma: unknown) => {
  const unused = {} as any;
  return new ShareService(
    prisma as any,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    { t: (key: string) => key } as any,
    unused,
  );
};

describe("reopening a completed share", () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stale-zip-"));
    fs.mkdirSync(path.join(root, SHARE_ID));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("removes the prebuilt zip so removed files cannot be served from it", async () => {
    const zip = path.join(root, SHARE_ID, "archive.zip");
    fs.writeFileSync(zip, "old zip with a file the owner will remove");
    fs.writeFileSync(`${zip}.part`, "half written");
    fs.writeFileSync(path.join(root, SHARE_ID, "file-1"), "kept");
    const prisma = {
      share: {
        findUnique: jest.fn(async () => ({
          id: SHARE_ID,
          uploadLocked: true,
          reverseShare: null,
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
    };

    await construct(prisma).revertComplete(SHARE_ID);

    expect(fs.existsSync(zip)).toBe(false);
    expect(fs.existsSync(`${zip}.part`)).toBe(false);
    expect(fs.existsSync(path.join(root, SHARE_ID, "file-1"))).toBe(true);
    expect(prisma.share.updateMany).toHaveBeenCalledWith({
      where: { id: SHARE_ID, uploadLocked: true },
      data: { uploadLocked: false, isZipReady: false },
    });
  });
});
