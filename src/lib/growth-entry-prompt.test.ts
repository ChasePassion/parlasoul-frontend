import assert from "node:assert/strict";
import test from "node:test";

import {
  getGrowthEntryDismissKey,
  shouldEvaluateGrowthEntryAutoOpenForSession,
  shouldAutoOpenGrowthEntryPopup,
} from "./growth-entry-prompt";

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
