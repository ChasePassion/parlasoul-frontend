import assert from "node:assert/strict";
import test from "node:test";

import {
  beginProfileSetupLoginIntent,
  canContinueProfileSetup,
  clearProfileSetupState,
  hasProfileSetupLoginIntent,
  isProfileSetupPendingForUser,
  markProfileSetupPending,
} from "./profile-setup-session";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test("profile setup login intent allows the next incomplete user to continue setup", () => {
  const storage = new MemoryStorage();

  beginProfileSetupLoginIntent(storage);

  assert.equal(hasProfileSetupLoginIntent(storage), true);
  assert.equal(canContinueProfileSetup("user-1", storage), true);
});

test("marking setup pending binds the setup flow to a single user", () => {
  const storage = new MemoryStorage();

  beginProfileSetupLoginIntent(storage);
  markProfileSetupPending("user-1", storage);

  assert.equal(hasProfileSetupLoginIntent(storage), false);
  assert.equal(isProfileSetupPendingForUser("user-1", storage), true);
  assert.equal(isProfileSetupPendingForUser("user-2", storage), false);
  assert.equal(canContinueProfileSetup("user-1", storage), true);
  assert.equal(canContinueProfileSetup("user-2", storage), false);
});

test("clearing setup state removes both login intent and pending user", () => {
  const storage = new MemoryStorage();

  beginProfileSetupLoginIntent(storage);
  markProfileSetupPending("user-1", storage);
  clearProfileSetupState(storage);

  assert.equal(hasProfileSetupLoginIntent(storage), false);
  assert.equal(isProfileSetupPendingForUser("user-1", storage), false);
  assert.equal(canContinueProfileSetup("user-1", storage), false);
});
