import assert from "node:assert/strict";
import test from "node:test";

import { isR2AvatarImageKey, resolveCharacterAvatarSrc } from "./character-avatar";

test("returns default avatar when avatar is missing", () => {
  assert.equal(resolveCharacterAvatarSrc(undefined), "/default-avatar.svg");
  assert.equal(resolveCharacterAvatarSrc(null), "/default-avatar.svg");
  assert.equal(resolveCharacterAvatarSrc(""), "/default-avatar.svg");
});

test("rejects legacy local avatar values", () => {
  assert.equal(
    resolveCharacterAvatarSrc("avatar-123.png"),
    "/default-avatar.svg",
  );
});

test("resolves R2 avatar image keys to media variants", () => {
  assert.equal(
    resolveCharacterAvatarSrc("images/avatars/characters/user-1/image-1", "sm"),
    "/media/images/avatars/characters/user-1/image-1/96.avif",
  );
  assert.equal(
    resolveCharacterAvatarSrc(
      { avatar_image_key: "images/avatars/characters/user-1/image-1" },
      "xl",
    ),
    "/media/images/avatars/characters/user-1/image-1/512.avif",
  );
});

test("identifies R2 avatar image keys", () => {
  assert.equal(
    isR2AvatarImageKey("images/avatars/characters/user-1/image-1"),
    true,
  );
  assert.equal(isR2AvatarImageKey("avatar-123.png"), false);
  assert.equal(isR2AvatarImageKey(null), false);
});

test("prefers backend avatar_urls over derived image key", () => {
  assert.equal(
    resolveCharacterAvatarSrc(
      {
        name: "Elon Musk",
        avatar_urls: {
          sm: "/media/from-response/96.avif",
          md: "/media/from-response/192.avif",
          lg: "/media/from-response/512.avif",
          xl: "/media/from-response/512.avif",
        },
        avatar_image_key: "images/avatars/characters/user-1/image-1",
      },
      "md",
    ),
    "/media/from-response/192.avif",
  );
});

test("resolves built-in character avatar assets when backend avatar fields are empty", () => {
  assert.equal(
    resolveCharacterAvatarSrc({
      name: "Elon Musk",
      avatar_image_key: null,
      avatar_urls: null,
    }),
    "/Elon.png",
  );
  assert.equal(
    resolveCharacterAvatarSrc({ name: "Gork" }),
    "/Gork.png",
  );
  assert.equal(
    resolveCharacterAvatarSrc({ name: "Xiao Bai" }),
    "/Bai.png",
  );
  assert.equal(
    resolveCharacterAvatarSrc({ name: "小白" }),
    "/Bai.png",
  );
});

test("rejects absolute and inline avatar sources", () => {
  assert.equal(
    resolveCharacterAvatarSrc("https://cdn.example.com/avatar.png"),
    "/default-avatar.svg",
  );
  assert.equal(
    resolveCharacterAvatarSrc("data:image/png;base64,abc"),
    "/default-avatar.svg",
  );
  assert.equal(
    resolveCharacterAvatarSrc("blob:https://app.example.com/123"),
    "/default-avatar.svg",
  );
});
