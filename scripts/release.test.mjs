// node --test scripts/release.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import semver from "../frontend/node_modules/semver/index.js";
import { nextVersion } from "./release.mjs";

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
