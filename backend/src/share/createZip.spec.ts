import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ShareService } from "./share.service";

// a getter rather than a fixed value, so each test can point the share
// directory at its own temporary root without reloading the module
jest.mock("../constants", () => ({
  get SHARE_DIRECTORY() {
    return root;
  },
}));

// A share of more than one file is downloaded as a zip that this builds, and
// nothing checked that the zip was a zip. That mattered when the archiver
// major changed how it is constructed, so this makes the output the thing
// under test rather than the call: real files on disk, a real archive, read
// back with unzip.

const SHARE_ID = "zip-spec-share";

let root = "";

const shareDir = () => path.join(root, SHARE_ID);

const writeFile = (id: string, contents: string) =>
  fs.writeFileSync(path.join(shareDir(), id), contents);

// createZip only reaches prisma and config, which are the first and the
// fifth of eleven constructor arguments
const construct = (prisma: unknown, config: unknown) => {
  const unused = {} as any;
  return new ShareService(
    prisma as any,
    unused,
    unused,
    unused,
    config as any,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
  );
};

const shareUpdate = jest.fn();

const build = (
  files: { id: string; name: string }[],
  { storageProvider = "LOCAL", s3Enabled = false } = {},
) =>
  construct(
    {
      file: { findMany: async () => files },
      share: {
        update: shareUpdate,
        findUnique: async () => ({ storageProvider }),
      },
    },
    { get: (key: string) => (key === "s3.enabled" ? s3Enabled : 5) },
  );

const entriesOf = (zip: string) =>
  execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .sort();

const contentsOf = (zip: string, name: string) =>
  execFileSync("unzip", ["-p", zip, name], { encoding: "utf8" });

beforeEach(() => {
  shareUpdate.mockReset();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pingvin-zip-"));
  fs.mkdirSync(shareDir());
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("createZip", () => {
  it("writes an archive holding every file under its own name", async () => {
    writeFile("id-one", "first file");
    writeFile("id-two", "second file");

    await build([
      { id: "id-one", name: "notes.txt" },
      { id: "id-two", name: "report.txt" },
    ]).createZip(SHARE_ID);

    const zip = path.join(shareDir(), "archive.zip");
    expect(fs.existsSync(zip)).toBe(true);
    expect(entriesOf(zip)).toEqual(["notes.txt", "report.txt"]);
  });

  it("keeps the bytes intact", async () => {
    writeFile("id-one", "the exact contents");

    await build([{ id: "id-one", name: "notes.txt" }]).createZip(SHARE_ID);

    expect(contentsOf(path.join(shareDir(), "archive.zip"), "notes.txt")).toBe(
      "the exact contents",
    );
  });

  it("keeps the folder structure a name carries", async () => {
    writeFile("id-one", "inside a folder");

    await build([{ id: "id-one", name: "docs/readme.md" }]).createZip(SHARE_ID);

    expect(entriesOf(path.join(shareDir(), "archive.zip"))).toEqual([
      "docs/readme.md",
    ]);
  });

  it("produces an archive unzip considers valid", async () => {
    writeFile("id-one", "a");
    writeFile("id-two", "b");

    await build([
      { id: "id-one", name: "a.txt" },
      { id: "id-two", name: "b.txt" },
    ]).createZip(SHARE_ID);

    expect(() =>
      execFileSync("unzip", ["-t", path.join(shareDir(), "archive.zip")], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("leaves no temporary file behind", async () => {
    writeFile("id-one", "a");

    await build([{ id: "id-one", name: "a.txt" }]).createZip(SHARE_ID);

    expect(fs.readdirSync(shareDir()).sort()).toEqual([
      "archive.zip",
      "id-one",
    ]);
  });

  it("only shows the archive under its real name once it is whole", async () => {
    writeFile("id-one", "a".repeat(5_000_000));
    const zip = path.join(shareDir(), "archive.zip");
    const seen: number[] = [];
    // watch the share directory while the zip is written
    const timer = setInterval(() => {
      if (fs.existsSync(zip)) seen.push(fs.statSync(zip).size);
    }, 1);

    await build([{ id: "id-one", name: "a.txt" }]).createZip(SHARE_ID);
    clearInterval(timer);

    const final = fs.statSync(zip).size;
    expect(seen.every((size) => size === final)).toBe(true);
  });

  it("marks the share ready once the archive is on disk", async () => {
    writeFile("id-one", "a");

    await build([{ id: "id-one", name: "a.txt" }]).createZip(SHARE_ID);

    expect(shareUpdate).toHaveBeenCalledWith({
      where: { id: SHARE_ID },
      data: { isZipReady: true },
    });
  });

  // createZip runs in the background after a share is completed. A rejection
  // there has nobody to catch it and takes the whole process down.
  it("survives a file that is missing from disk", async () => {
    writeFile("id-one", "a");

    await expect(
      build([
        { id: "id-one", name: "a.txt" },
        { id: "id-gone", name: "b.txt" },
      ]).createZip(SHARE_ID),
    ).resolves.toBeUndefined();

    expect(fs.existsSync(path.join(shareDir(), "archive.zip"))).toBe(false);
    expect(fs.existsSync(path.join(shareDir(), "archive.zip.part"))).toBe(
      false,
    );
    expect(shareUpdate).not.toHaveBeenCalled();
  });

  it("never writes outside the share directory", async () => {
    // a real folder next to the share directory, with a file the zip could use
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "pingvin-outside-"));
    fs.writeFileSync(path.join(outside, "id-one"), "a");

    try {
      await build([{ id: "id-one", name: "a.txt" }]).createZip(
        path.relative(root, outside),
      );

      expect(fs.existsSync(path.join(outside, "archive.zip"))).toBe(false);
      expect(shareUpdate).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  const openWithoutZip = (downloadAll: string) => {
    const service = construct(
      {
        share: {
          findUnique: async () => ({
            id: SHARE_ID,
            uploadLocked: true,
            isZipReady: false,
            _count: { files: 2 },
          }),
        },
      },
      { get: (key: string) => key === "share.downloadAll" && downloadAll },
    );
    const createZip = jest
      .spyOn(service, "createZip")
      .mockResolvedValue(undefined);
    return { service, createZip };
  };

  it("is started again when a share is opened without its zip", async () => {
    const { service, createZip } = openWithoutZip("zip-prebuilt");

    await service.getMetaData(SHARE_ID);

    expect(createZip).toHaveBeenCalledWith(SHARE_ID);
  });

  // only the prebuilt mode keeps a zip on disk, the others must not fill it
  it.each(["disabled", "zip-on-the-fly", "files"])(
    "is not built when download all is %s",
    async (mode) => {
      const { service, createZip } = openWithoutZip(mode);

      await service.getMetaData(SHARE_ID);

      expect(createZip).not.toHaveBeenCalled();
    },
  );

  // an S3 share is zipped on the fly while it downloads, so there is nothing
  // to build and the download all button must not wait for it
  it("marks an S3 share ready without building anything", async () => {
    await build([{ id: "id-one", name: "a.txt" }], {
      storageProvider: "S3",
      s3Enabled: true,
    }).createZip(SHARE_ID);

    expect(fs.existsSync(path.join(shareDir(), "archive.zip"))).toBe(false);
    expect(shareUpdate).toHaveBeenCalledWith({
      where: { id: SHARE_ID },
      data: { isZipReady: true },
    });
  });

  // shares keep the storage they were uploaded to, switching S3 on later
  // must not leave the older local ones without a zip
  it("still builds the zip of a local share once S3 is switched on", async () => {
    writeFile("id-one", "a");

    await build([{ id: "id-one", name: "a.txt" }], {
      storageProvider: "LOCAL",
      s3Enabled: true,
    }).createZip(SHARE_ID);

    expect(fs.existsSync(path.join(shareDir(), "archive.zip"))).toBe(true);
  });
});
