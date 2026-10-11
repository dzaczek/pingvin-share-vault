// node --test scripts/release.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import semver from "semver";
import { changelogSection, nextVersion, previousRelease } from "./release.mjs";

const october = new Date(2026, 9, 10);

test("starts a month at .0", () => {
  assert.equal(nextVersion(october, []), "2026.10.0");
});

test("counts up within the month", () => {
  assert.equal(nextVersion(october, ["v2026.10.0", "v2026.10.1"]), "2026.10.2");
});

test("ignores other months and the original project's tags", () => {
  assert.equal(
    nextVersion(october, ["v2026.9.4", "v2.0.0", "v1.21.1", "v2026.1.0"]),
    "2026.10.0",
  );
});

test("never writes a leading zero, which semver rejects", () => {
  const version = nextVersion(new Date(2027, 0, 5), []);
  assert.equal(version, "2027.1.0");
  assert.ok(semver.valid(version));
});

test("orders correctly against the old numbering", () => {
  assert.ok(semver.gt("2026.10.0", "2.0.0-beta.1"));
  assert.ok(semver.gt("2026.11.0", "2026.10.9"));
});

// The repository carries the original project's history and tags since the
// upstream sync merge. Neither may end up in this fork's changelog.

test("takes the newest calendar tag as the previous release", () => {
  assert.equal(
    previousRelease(["v2.0.0", "v2026.9.3", "v2026.10.0", "v1.22.1", "v2.0.0-beta.4"]),
    "v2026.10.0",
  );
  assert.equal(previousRelease(["v2026.10.9", "v2026.10.10"]), "v2026.10.10");
  assert.equal(previousRelease(["v2.0.0"]), undefined);
});

const commits = [
  { hash: "aaaaaaa1111", subject: "fix(deps): close the critical alerts" },
  { hash: "bbbbbbb2222", subject: "feat(user): add an optional display name" },
  { hash: "ccccccc3333", subject: "chore: tidy up" },
  { hash: "ddddddd4444", subject: "test(integration): cover more" },
  { hash: "eeeeeee5555", subject: "feat!: number releases by date" },
  { hash: "fffffff6666", subject: "fix: plain fix without scope" },
];

test("writes a section with breaking changes, features and fixes", () => {
  const text = changelogSection({
    version: "2026.10.1",
    previous: "v2026.10.0",
    date: new Date(2026, 9, 11),
    commits,
    repository: "dzaczek/pingvin-share-x",
  });
  assert.equal(
    text,
    `## [2026.10.1](https://github.com/dzaczek/pingvin-share-x/compare/v2026.10.0...v2026.10.1) (2026-10-11)

### ⚠ BREAKING CHANGES

* number releases by date ([eeeeeee](https://github.com/dzaczek/pingvin-share-x/commit/eeeeeee5555))

### Features

* **user:** add an optional display name ([bbbbbbb](https://github.com/dzaczek/pingvin-share-x/commit/bbbbbbb2222))
* number releases by date ([eeeeeee](https://github.com/dzaczek/pingvin-share-x/commit/eeeeeee5555))

### Bug Fixes

* **deps:** close the critical alerts ([aaaaaaa](https://github.com/dzaczek/pingvin-share-x/commit/aaaaaaa1111))
* plain fix without scope ([fffffff](https://github.com/dzaczek/pingvin-share-x/commit/fffffff6666))
`,
  );
});

test("says so when a release has nothing to list", () => {
  const text = changelogSection({
    version: "2026.10.2",
    previous: "v2026.10.1",
    date: new Date(2026, 9, 11),
    commits: [{ hash: "ccccccc3333", subject: "chore: tidy up" }],
    repository: "dzaczek/pingvin-share-x",
  });
  assert.match(text, /Maintenance only/);
});
