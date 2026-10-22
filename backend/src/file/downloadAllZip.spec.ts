import { NotFoundException } from "@nestjs/common";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { FileService } from "./file.service";
import { LocalFileService } from "./local.service";

jest.mock("../constants", () => ({
  get SHARE_DIRECTORY() {
    return root;
  },
}));

// The download all button has an admin setting: off, a zip built in the
// background after upload, a zip built while it downloads, or every file
// downloaded on its own. The zip route has to agree with that setting, and
// the zip built on the fly has to be a whole one, with nothing quietly left
// out of it.

const SHARE_ID = "zip-spec-share";

let root = "";

const shareDir = () => path.join(root, SHARE_ID);

const writeFile = (id: string, contents: string) =>
  fs.writeFileSync(path.join(shareDir(), id), contents);

const configWith = (mode: string) => ({
  get: (key: string) => (key === "share.downloadAll" ? mode : 5),
});

const local = (mode: string, files: { id: string; name: string }[] = []) =>
  new LocalFileService(
    { file: { findMany: async () => files } } as any,
    configWith(mode) as any,
    { t: (key: string) => key } as any,
  );

// getZip reaches prisma, the local service and config, the first, second and
// fourth of eight constructor arguments
const service = (mode: string, localService: unknown) => {
  const unused = {} as any;
  return new FileService(
    { share: { findFirst: async () => ({ storageProvider: "LOCAL" }) } } as any,
    localService as any,
    unused,
    configWith(mode) as any,
    unused,
    { t: (key: string) => key } as any,
    unused,
    unused,
  );
};

const saveTo = async (stream: Readable) => {
  const zip = path.join(root, "download.zip");
  await pipeline(stream, fs.createWriteStream(zip));
  return zip;
};

const entriesOf = (zip: string) =>
  execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .sort();

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pingvin-zip-"));
  fs.mkdirSync(shareDir());
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("the zip built while it downloads", () => {
  it("holds every file under its own name", async () => {
    writeFile("id-one", "first file");
    writeFile("id-two", "second file");

    const zip = await saveTo(
      await local("zip-on-the-fly", [
        { id: "id-one", name: "notes.txt" },
        { id: "id-two", name: "docs/report.txt" },
      ]).getZip(SHARE_ID),
    );

    expect(entriesOf(zip)).toEqual(["docs/report.txt", "notes.txt"]);
    expect(
      execFileSync("unzip", ["-p", zip, "notes.txt"], { encoding: "utf8" }),
    ).toBe("first file");
  });

  it("leaves nothing behind on disk", async () => {
    writeFile("id-one", "a");

    await saveTo(
      await local("zip-on-the-fly", [{ id: "id-one", name: "a.txt" }]).getZip(
        SHARE_ID,
      ),
    );

    expect(fs.existsSync(path.join(shareDir(), "archive.zip"))).toBe(false);
  });

  // archiver only warns about a missing file and carries on, the download
  // would then look fine and be a zip without it. Found halfway, nest would
  // answer with the error itself, which names the path on disk.
  it("is not found rather than a zip with a file missing", async () => {
    writeFile("id-one", "a");

    await expect(
      local("zip-on-the-fly", [
        { id: "id-one", name: "a.txt" },
        { id: "id-gone", name: "b.txt" },
      ]).getZip(SHARE_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("the zip built after upload", () => {
  it("is the archive already on disk", async () => {
    writeFile("archive.zip", "a prebuilt zip");

    const stream = await local("zip-prebuilt").getZip(SHARE_ID);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);

    expect(Buffer.concat(chunks).toString()).toBe("a prebuilt zip");
  });

  it("is not found while it is still being written", async () => {
    writeFile("archive.zip.part", "half of a zip");

    await expect(local("zip-prebuilt").getZip(SHARE_ID)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("the zip route", () => {
  it.each(["disabled", "files"])(
    "is not there when the mode is %s",
    async (mode) => {
      const getZip = jest.fn();

      await expect(
        service(mode, { getZip }).getZip(SHARE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(getZip).not.toHaveBeenCalled();
    },
  );

  it.each(["zip-prebuilt", "zip-on-the-fly"])(
    "hands out the zip when the mode is %s",
    async (mode) => {
      const stream = Readable.from(["zip"]);
      const getZip = jest.fn().mockResolvedValue(stream);

      await expect(service(mode, { getZip }).getZip(SHARE_ID)).resolves.toBe(
        stream,
      );
    },
  );
});
