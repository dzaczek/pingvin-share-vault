// A file name is a path relative to the share, a folder upload sends
// "photos/a.jpg". It becomes an S3 key and a zip entry, so it must not climb
// out of the share: no "..", no ".", no leading slash. Returns "" when
// nothing is left.
export function safeFileName(name: string) {
  return `${name ?? ""}`
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}
