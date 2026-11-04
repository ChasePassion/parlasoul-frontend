import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function parseStableVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  assert.ok(match, `Better Auth must use a stable release, received ${version}`);

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isAtLeast(
  actual: [number, number, number],
  minimum: [number, number, number],
): boolean {
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== minimum[index]) {
      return actual[index] > minimum[index];
    }
  }

  return true;
}

test("uses a Better Auth release containing the session mount race fix", () => {
  const packageJsonUrl = new URL(
    "../../node_modules/better-auth/package.json",
    import.meta.url,
  );
  const { version } = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as {
    version: string;
  };

  assert.equal(
    isAtLeast(parseStableVersion(version), [1, 6, 3]),
    true,
    `Better Auth ${version} can issue concurrent get-session requests; upgrade to 1.6.3 or newer`,
  );
});
