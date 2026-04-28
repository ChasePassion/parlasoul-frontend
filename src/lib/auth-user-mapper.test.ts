import assert from "node:assert/strict";
import test from "node:test";

import {
  mapBetterAuthSessionToUser,
  mapBetterAuthUserToUser,
} from "./auth-user-mapper";

test("maps Better Auth user fields to the backend user contract", () => {
  const result = mapBetterAuthUserToUser({
    id: "user-1",
    email: "chase@example.com",
    username: "  chase  ",
    emailVerified: true,
    createdAt: "2026-04-05T10:20:30.000Z",
    lastLoginAt: new Date("2026-04-06T11:22:33.000Z"),
  });

  assert.deepEqual(result, {
    id: "user-1",
    email: "chase@example.com",
    username: "chase",
    email_verified: true,
    created_at: "2026-04-05T10:20:30.000Z",
    last_login_at: "2026-04-06T11:22:33.000Z",
  });
});

test("omits blank optional fields and normalizes invalid dates to epoch", () => {
  const result = mapBetterAuthUserToUser({
    id: "user-1",
    email: "chase@example.com",
    username: "   ",
    emailVerified: null,
    createdAt: "not-a-date",
  });

  assert.deepEqual(result, {
    id: "user-1",
    email: "chase@example.com",
    username: undefined,
    email_verified: false,
    created_at: "1970-01-01T00:00:00.000Z",
    last_login_at: undefined,
  });
});

test("returns null when Better Auth has no active session user", () => {
  assert.equal(mapBetterAuthUserToUser(null), null);
  assert.equal(mapBetterAuthSessionToUser(null), null);
});
