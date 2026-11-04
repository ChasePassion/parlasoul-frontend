import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShareUrl,
  generateCharacterSlug,
  parseUuidFromSlug,
  slugifyName,
} from "./share-link";

const CHARACTER_ID = "123e4567-e89b-12d3-a456-426614174000";

test("slugifies character names for share URLs", () => {
  assert.equal(slugifyName("  Luna, Star!  "), "luna-star");
  assert.equal(slugifyName("!!!"), "character");
});

test("generates and parses direct character share slugs", () => {
  const slug = generateCharacterSlug("Luna Star", CHARACTER_ID);

  assert.equal(slug, `luna-star-${CHARACTER_ID}`);
  assert.equal(parseUuidFromSlug(slug), CHARACTER_ID);
});

test("rejects malformed share slugs", () => {
  assert.equal(parseUuidFromSlug("luna-not-a-uuid"), null);
  assert.equal(parseUuidFromSlug("short"), null);
});

test("builds a relative share URL during server-side tests", () => {
  assert.equal(
    buildShareUrl("Luna Star", CHARACTER_ID),
    `/share/luna-star-${CHARACTER_ID}`,
  );
});
