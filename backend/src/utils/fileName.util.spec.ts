import { safeFileName } from "./fileName.util";

// The name is the S3 key below the share and the path inside the zip. A name
// like "../other-share/x" would point at another share's object on a store
// that resolves the dots, and would unpack outside the target folder.

describe("safeFileName", () => {
  it("keeps a plain name", () => {
    expect(safeFileName("report.pdf")).toBe("report.pdf");
  });

  it("keeps the folders of a folder upload", () => {
    expect(safeFileName("photos/2026/a.jpg")).toBe("photos/2026/a.jpg");
  });

  it("drops dot segments anywhere in the path", () => {
    expect(safeFileName("../../etc/passwd")).toBe("etc/passwd");
    expect(safeFileName("dir/../../up.txt")).toBe("dir/up.txt");
    expect(safeFileName("./a/./b.txt")).toBe("a/b.txt");
  });

  it("drops a leading slash and empty segments", () => {
    expect(safeFileName("/abs.txt")).toBe("abs.txt");
    expect(safeFileName("a//b.txt")).toBe("a/b.txt");
  });

  it("treats a backslash as a separator", () => {
    expect(safeFileName("..\\..\\win.ini")).toBe("win.ini");
  });

  it("keeps dots that are part of a name", () => {
    expect(safeFileName("..hidden")).toBe("..hidden");
    expect(safeFileName("a..b/c...txt")).toBe("a..b/c...txt");
  });

  it("returns nothing for a name made of dots only", () => {
    expect(safeFileName("..")).toBe("");
    expect(safeFileName("/../.")).toBe("");
    expect(safeFileName("")).toBe("");
  });
});
