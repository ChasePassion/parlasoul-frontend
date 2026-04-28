import assert from "node:assert/strict";
import test from "node:test";

import {
  getCharacterTagKey,
  hasCharacterTag,
  normalizeCharacterTag,
} from "./character-tags";

test("normalizes character tags by trimming and collapsing whitespace", () => {
  assert.equal(normalizeCharacterTag("  daily   English  "), "daily English");
});

test("uses case-insensitive keys for duplicate tag detection", () => {
  assert.equal(getCharacterTagKey("  Daily English "), "daily english");
  assert.equal(hasCharacterTag(["Daily English"], "daily english"), true);
  assert.equal(hasCharacterTag(["Daily English"], "business"), false);
});
