import assert from "node:assert/strict";
import test from "node:test";

import {
  getGrowthEntryDismissKey,
  getGrowthEntrySessionHandledKey,
  markGrowthEntryAutoOpenHandledForSession,
  readGrowthEntryAutoOpenHandledStatDate,
  shouldEvaluateGrowthEntryAutoOpenForSession,
  shouldAutoOpenGrowthEntryPopup,
} from "./growth-entry-prompt";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

test("auto opens on entry when today is not dismissed even if backend no longer flags first entry", () => {
  assert.equal(
    shouldAutoOpenGrowthEntryPopup({
      statDate: "2026-04-05",
      dismissedStatDate: null,
    }),
    true,
  );
});

test("suppresses the popup when the current stat date has been dismissed", () => {
  assert.equal(
    shouldAutoOpenGrowthEntryPopup({
      statDate: "2026-04-05",
      dismissedStatDate: "2026-04-05",
    }),
    false,
  );
});

test("shows the popup again when the dismissed date is from a previous day", () => {
  assert.equal(
    shouldAutoOpenGrowthEntryPopup({
      statDate: "2026-04-05",
      dismissedStatDate: "2026-04-04",
    }),
    true,
  );
});

test("does not auto open when the stat date is missing", () => {
  assert.equal(
    shouldAutoOpenGrowthEntryPopup({
      statDate: null,
      dismissedStatDate: null,
    }),
    false,
  );
});

test("does not re-evaluate auto open for the same stat date within one app session", () => {
  assert.equal(
    shouldEvaluateGrowthEntryAutoOpenForSession({
      statDate: "2026-04-06",
      lastHandledStatDate: "2026-04-06",
    }),
    false,
  );
  assert.equal(
    shouldEvaluateGrowthEntryAutoOpenForSession({
      statDate: "2026-04-06",
      lastHandledStatDate: "2026-04-05",
    }),
    true,
  );
});

test("scopes the dismissal storage key by user id", () => {
  assert.equal(
    getGrowthEntryDismissKey("user-123"),
    "growth_entry_popup_dismissed_stat_date_v1:user-123",
  );
  assert.equal(
    getGrowthEntryDismissKey(null),
    "growth_entry_popup_dismissed_stat_date_v1",
  );
});

test("scopes the session handled key by user id", () => {
  assert.equal(
    getGrowthEntrySessionHandledKey("user-123"),
    "growth_entry_popup_handled_stat_date_v1:user-123",
  );
  assert.equal(
    getGrowthEntrySessionHandledKey(null),
    "growth_entry_popup_handled_stat_date_v1",
  );
});

test("persists the handled stat date within the same tab session", () => {
  const storage = createMemoryStorage();

  markGrowthEntryAutoOpenHandledForSession("2026-04-06", "user-123", storage);

  assert.equal(
    readGrowthEntryAutoOpenHandledStatDate("user-123", storage),
    "2026-04-06",
  );
});

test("reuses the persisted handled stat date after a remount-like re-entry in the same tab", () => {
  const storage = createMemoryStorage();

  markGrowthEntryAutoOpenHandledForSession("2026-04-06", "user-123", storage);

  assert.equal(
    shouldEvaluateGrowthEntryAutoOpenForSession({
      statDate: "2026-04-06",
      lastHandledStatDate: readGrowthEntryAutoOpenHandledStatDate(
        "user-123",
        storage,
      ),
    }),
    false,
  );
  assert.equal(
    shouldEvaluateGrowthEntryAutoOpenForSession({
      statDate: "2026-04-06",
      lastHandledStatDate: readGrowthEntryAutoOpenHandledStatDate(
        "user-456",
        storage,
      ),
    }),
    true,
  );
});
