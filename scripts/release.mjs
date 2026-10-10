// Cuts a release of this fork.
//
// Versions are year.month.n: 2026.10.0 is the first release of October 2026,
// 2026.10.1 the next one that month. Still valid semver, so npm, the admin
// update check and the docker tags keep working, and the tags (v2026.10.0)
// can never collide with the original project's v1.x and v2.x tags.
//
//   npm run release              bump, commit and tag locally
//   npm run release -- --dry-run only print the next version
//
// Pushing and publishing stay a separate, deliberate step, see the output.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPOSITORY = "dzaczek/pingvin-share-x";

// semver forbids leading zeros, so January is 2027.1.0, never 2027.01.0
export function nextVersion(date, tags) {
  const prefix = `${date.getFullYear()}.${date.getMonth() + 1}.`;
  const taken = tags
    .map((tag) => tag.replace(/^v/, ""))
    .filter((v) => v.startsWith(prefix))
    .map((v) => Number(v.slice(prefix.length)))
    .filter(Number.isInteger);
  return prefix + (taken.length ? Math.max(...taken) + 1 : 0);
}

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

function main() {
  const dryRun = process.argv.includes("--dry-run");

  git("fetch", "--quiet", "--tags", "origin");
  const version = nextVersion(new Date(), git("tag", "--list").split("\n"));
  console.log(`next version: ${version}`);
  if (dryRun) return;

  if (git("status", "--porcelain")) {
    throw new Error("the working tree has changes, commit or stash them first");
  }

  // backend and frontend first, the root last: its version hook writes the
  // changelog and should see the whole release
  for (const dir of ["backend", "frontend", "."]) {
    execFileSync(
      "npm",
      ["version", version, "--no-git-tag-version", "--allow-same-version"],
      { cwd: dir, stdio: "inherit" },
    );
  }

  git(
    "add",
    "package.json",
    "package-lock.json",
    "CHANGELOG.md",
    "backend/package.json",
    "backend/package-lock.json",
    "frontend/package.json",
    "frontend/package-lock.json",
  );
  git("commit", "-m", `release: v${version}`);
  git("tag", "-a", `v${version}`, "-m", `v${version}`);

  console.log(`
Committed and tagged v${version}. To publish it:

  git push origin HEAD
  git push origin v${version}
  gh release create v${version} --repo ${REPOSITORY} --generate-notes

Publishing the GitHub release is what the admin update check looks at.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
