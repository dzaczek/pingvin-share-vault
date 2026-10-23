// Cuts a release of this fork.
//
// Versions are year.month.n: 2026.10.0 is the first release of October 2026,
// 2026.10.1 the next one that month. Still valid semver, so npm, the admin
// update check and the docker tags keep working, and the tags (v2026.10.0)
// can never collide with the original project's v1.x and v2.x tags.
//
//   npm run release              bump, write the changelog, commit and tag
//   npm run release -- --dry-run only print the next version and changelog
//   npm run release -- --beta    a prerelease of the next version, 2026.10.3-beta.0
//
// Pushing and publishing stay a separate, deliberate step, see the output.

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const REPOSITORY = "dzaczek/pingvin-share-vault";

// a four digit year tells this fork's tags apart from upstream's v2.0.0
const CALENDAR_TAG = /^v(\d{4})\.(\d+)\.(\d+)$/;

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

// A beta leaves the changelog alone, the final release lists everything
// since the last one. Betas are not counted by nextVersion, "3-beta.0" is
// not a number, so the beta and the release after it share the version.
export function nextBeta(date, tags) {
  const base = `${nextVersion(date, tags)}-beta.`;
  const taken = tags
    .map((tag) => tag.replace(/^v/, ""))
    .filter((v) => v.startsWith(base))
    .map((v) => Number(v.slice(base.length)))
    .filter(Number.isInteger);
  return base + (taken.length ? Math.max(...taken) + 1 : 0);
}

export function previousRelease(tags) {
  const key = (tag) => CALENDAR_TAG.exec(tag).slice(1).map(Number);
  return tags
    .filter((tag) => CALENDAR_TAG.test(tag))
    .sort((a, b) => {
      const [x, y] = [key(a), key(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    })
    .pop();
}

const SECTIONS = [
  ["feat", "Features"],
  ["fix", "Bug Fixes"],
  ["perf", "Performance Improvements"],
  ["revert", "Reverts"],
];

// Same shape as the conventional changelog the file already holds. Only
// feat, fix, perf and revert are listed, like that preset does.
export function changelogSection({ version, previous, date, commits, repository }) {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const parsed = commits
    .map(({ hash, subject }) => {
      const m = /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/.exec(subject);
      return m && { hash, type: m[1], scope: m[2], breaking: !!m[3], text: m[4] };
    })
    .filter(Boolean);
  const line = (c) =>
    `* ${c.scope ? `**${c.scope}:** ` : ""}${c.text} ` +
    `([${c.hash.slice(0, 7)}](https://github.com/${repository}/commit/${c.hash}))`;

  const blocks = [];
  const breaking = parsed.filter((c) => c.breaking);
  if (breaking.length) {
    blocks.push(`### ⚠ BREAKING CHANGES\n\n${breaking.map(line).join("\n")}`);
  }
  for (const [type, title] of SECTIONS) {
    const list = parsed.filter((c) => c.type === type);
    if (list.length) blocks.push(`### ${title}\n\n${list.map(line).join("\n")}`);
  }
  if (!blocks.length) blocks.push("Maintenance only, no user facing changes.");

  const compare = previous
    ? `https://github.com/${repository}/compare/${previous}...v${version}`
    : `https://github.com/${repository}/releases/tag/v${version}`;
  return `## [${version}](${compare}) (${day})\n\n${blocks.join("\n\n")}\n`;
}

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

// Commits since the previous release, minus everything the original project
// has: since the upstream sync merge its history is reachable from here too.
function releaseCommits(previous) {
  const remotes = git("remote").split("\n");
  const args = ["log", "--no-merges", "--format=%H%x09%s"];
  args.push(previous ? `${previous}..HEAD` : "HEAD");
  if (remotes.includes("upstream")) args.push("--not", "--remotes=upstream");
  else console.warn("no upstream remote, upstream commits may show up");
  return git(...args)
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [hash, subject] = l.split("\t");
      return { hash, subject };
    });
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const beta = process.argv.includes("--beta");

  git("fetch", "--quiet", "--tags", "origin");
  if (git("remote").split("\n").includes("upstream")) {
    git("fetch", "--quiet", "upstream");
  }
  const tags = git("tag", "--list", "--merged", "HEAD").split("\n");
  const allTags = git("tag", "--list").split("\n");
  const version = beta
    ? nextBeta(new Date(), allTags)
    : nextVersion(new Date(), allTags);
  const previous = previousRelease(tags);
  const section = changelogSection({
    version,
    previous,
    date: new Date(),
    commits: releaseCommits(previous),
    repository: REPOSITORY,
  });
  console.log(`next version: ${version}\n\n${section}`);
  if (dryRun) return;

  if (git("status", "--porcelain")) {
    throw new Error("the working tree has changes, commit or stash them first");
  }

  for (const dir of ["backend", "frontend", "."]) {
    execFileSync(
      "npm",
      ["version", version, "--no-git-tag-version", "--allow-same-version"],
      { cwd: dir, stdio: "inherit" },
    );
  }
  if (!beta) {
    let changelog = "";
    try {
      changelog = fs.readFileSync("CHANGELOG.md", "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    fs.writeFileSync("CHANGELOG.md", `${section}\n${changelog}`);
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

  console.log(`Committed and tagged v${version}. To publish it:

  git push origin HEAD
  git push origin v${version}
  gh release create v${version} --repo ${REPOSITORY} --generate-notes${beta ? " --prerelease" : ""}

Publishing the GitHub release is what the admin update check looks at.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
