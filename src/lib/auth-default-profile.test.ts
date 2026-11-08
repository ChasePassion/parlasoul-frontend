import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeUsernameBase,
  resolvePresetAvatarUrl,
  resolveUniqueUsername,
} from "./auth-default-profile";

test("maps an email to a stable preset avatar inside the default folder", () => {
  const first = resolvePresetAvatarUrl("Chase@Example.com");
  const second = resolvePresetAvatarUrl("chase@example.com");

  assert.equal(first, second);
  assert.match(first, /^\/avatars\/default\/avatar-(0[1-9]|10)\.webp$/);
});

test("derives the username from the email local part", () => {
  assert.equal(normalizeUsernameBase("Chase.Smith+news@example.com"), "chase.smith");
  assert.equal(normalizeUsernameBase("a@example.com"), "a_");
  assert.equal(normalizeUsernameBase("张三@example.com"), "张三");
});

test("adds a numeric suffix when the username is already taken", async () => {
  const taken = new Set(["chase", "chase2"]);
  const pool = {
    async query(_text: string, values: unknown[]) {
      return { rowCount: taken.has(String(values[0])) ? 1 : 0 };
    },
  };

  assert.equal(await resolveUniqueUsername(pool, "chase"), "chase3");
});
