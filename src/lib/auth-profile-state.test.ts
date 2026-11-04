import assert from "node:assert/strict";
import test from "node:test";

import type { User } from "./api-service";
import {
  isProfileComplete,
  isProfileStatusComplete,
  isProfileStatusIncomplete,
} from "./auth-profile-state";

const baseUser: User = {
  id: "user-1",
  email: "chase@example.com",
  username: "chase",
  email_verified: true,
  created_at: "2026-04-05T10:20:30.000Z",
};

test("classifies profile completion only from a loaded backend profile", () => {
  const completedProfile: User = {
    ...baseUser,
    avatar_image_key: "images/avatars/users/user-1/avatar-1",
  };

  assert.equal(isProfileComplete(completedProfile), true);
  assert.equal(isProfileStatusComplete("loaded", completedProfile), true);
  assert.equal(isProfileStatusComplete("loading", completedProfile), false);
  assert.equal(isProfileStatusComplete("error", completedProfile), false);
});

test("does not classify a session-only fallback as setup incomplete before profile load succeeds", () => {
  assert.equal(isProfileComplete(baseUser), false);
  assert.equal(isProfileStatusIncomplete("loading", baseUser), false);
  assert.equal(isProfileStatusIncomplete("error", baseUser), false);
  assert.equal(isProfileStatusIncomplete("anonymous", baseUser), false);
});

test("classifies setup incomplete only after backend profile has loaded", () => {
  assert.equal(isProfileStatusIncomplete("loaded", baseUser), true);
});
