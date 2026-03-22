import assert from "node:assert/strict";
import test from "node:test";

import { resolveCharacterAvatarSrc } from "./character-avatar.ts";

test("returns default avatar when avatar is missing", () => {
  assert.equal(resolveCharacterAvatarSrc(undefined), "/default-avatar.svg");
  assert.equal(resolveCharacterAvatarSrc(null), "/default-avatar.svg");
  assert.equal(resolveCharacterAvatarSrc(""), "/default-avatar.svg");
});

test("prefixes upload path for bare file names", () => {
  assert.equal(
    resolveCharacterAvatarSrc("avatar-123.png"),
    "/uploads/avatar-123.png"
  );
});

test("preserves already resolved upload paths", () => {
  assert.equal(
    resolveCharacterAvatarSrc("/uploads/avatar-123.png"),
    "/uploads/avatar-123.png"
  );
});

test("preserves absolute and inline avatar sources", () => {
  assert.equal(
    resolveCharacterAvatarSrc("https://cdn.example.com/avatar.png"),
    "https://cdn.example.com/avatar.png"
  );
  assert.equal(
    resolveCharacterAvatarSrc("data:image/png;base64,abc"),
    "data:image/png;base64,abc"
  );
  assert.equal(
    resolveCharacterAvatarSrc("blob:https://app.example.com/123"),
    "blob:https://app.example.com/123"
  );
});
