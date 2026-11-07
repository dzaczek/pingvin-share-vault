import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LocalFileService } from "./local.service";

jest.mock("../constants", () => ({
  get SHARE_DIRECTORY() {
    return root;
  },
}));

// The lock was read once when a chunk arrived. Completing the share started
// the ClamAV scan in between, so a last chunk could land after the scan had
// listed the files, and the share was marked clean with bytes nobody scanned.
// A reused file id also replaced a file that had been scanned.

let root = "";
const SHARE = "late-chunk-share";
const FILE_ID = "6f1c2c4e-8a8b-4f7e-9a51-0b3e6a1d2c3f";

describe("the last chunk of a local upload", () => {
  let locked: boolean[];
  let prisma: any;
  let service: LocalFileService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "late-chunk-"));
    fs.mkdirSync(path.join(root, SHARE));
    locked = [false, false];
    prisma = {
      share: {
        findUnique: jest.fn(async () => ({
          id: SHARE,
          uploadLocked: locked.shift() ?? true,
          files: [],
          creator: null,
          reverseShare: null,
        })),
      },
      file: { create: jest.fn(async () => ({})) },
    };
    const config = {
      get: (key: string) =>
        ({ "share.maxSize": 1_000_000, "share.chunkSize": 1_000 })[key] ?? "",
    };
    service = new LocalFileService(
      prisma,
      config as any,
      {
        t: (key: string) => key,
      } as any,
    );
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const upload = () =>
    service.create(
      Buffer.from("hello").toString("base64"),
      { index: 0, total: 1 },
      { id: FILE_ID, name: "a.txt" },
      SHARE,
    );

  it("is stored while the share is open", async () => {
    await upload();
    expect(fs.existsSync(path.join(root, SHARE, FILE_ID))).toBe(true);
    expect(prisma.file.create).toHaveBeenCalled();
  });

  it("is refused once the share got locked while it was on its way", async () => {
    locked = [false, true];
    await expect(upload()).rejects.toMatchObject({ status: 400 });
    expect(fs.existsSync(path.join(root, SHARE, FILE_ID))).toBe(false);
    expect(fs.readdirSync(path.join(root, SHARE))).toEqual([]);
    expect(prisma.file.create).not.toHaveBeenCalled();
  });

  it("does not replace a file that is already there", async () => {
    fs.writeFileSync(path.join(root, SHARE, FILE_ID), "scanned");
    await expect(upload()).rejects.toMatchObject({ status: 400 });
    expect(fs.readFileSync(path.join(root, SHARE, FILE_ID), "utf8")).toBe(
      "scanned",
    );
  });
});

// The size checks counted the stored files and the current file's own
// partial upload. Several files uploading at once each saw room for itself
// and together went past the share limit.
describe("several local uploads at once", () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "parallel-upload-"));
    fs.mkdirSync(path.join(root, SHARE));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("count each other's partial files against the share limit", async () => {
    // another file is halfway through
    fs.writeFileSync(
      path.join(root, SHARE, "11111111-2222-4333-8444-555555555555.tmp-chunk"),
      Buffer.alloc(900),
    );
    const prisma = {
      share: {
        findUnique: jest.fn(async () => ({
          id: SHARE,
          uploadLocked: false,
          files: [],
          creator: null,
          reverseShare: null,
        })),
      },
      file: { create: jest.fn(async () => ({})) },
    };
    const config = {
      get: (key: string) =>
        ({ "share.maxSize": 1_000, "share.chunkSize": 10_000 })[key] ?? "",
    };
    const service = new LocalFileService(
      prisma as any,
      config as any,
      {
        t: (key: string) => key,
      } as any,
    );

    await expect(
      service.create(
        Buffer.alloc(200).toString("base64"),
        { index: 0, total: 1 },
        { id: FILE_ID, name: "b.bin" },
        SHARE,
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});
