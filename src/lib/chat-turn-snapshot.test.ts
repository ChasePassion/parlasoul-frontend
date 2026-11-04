import assert from "node:assert/strict";
import test from "node:test";

import { snapshotContainsTurnIds } from "./chat-turn-snapshot";

test("accepts snapshots when all required turn ids are present", () => {
  assert.equal(
    snapshotContainsTurnIds(
      [{ id: "user-1" }, { id: "assistant-1" }],
      ["user-1", "assistant-1"],
    ),
    true,
  );
});

test("rejects stale snapshots that do not include the latest streamed turns", () => {
  assert.equal(
    snapshotContainsTurnIds(
      [{ id: "older-user" }, { id: "older-assistant" }],
      ["user-1", "assistant-1"],
    ),
    false,
  );
});

test("ignores empty required turn ids", () => {
  assert.equal(
    snapshotContainsTurnIds([{ id: "older-user" }], [undefined, null, ""]),
    true,
  );
});
