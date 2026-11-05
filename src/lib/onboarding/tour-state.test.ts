import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdjacentStepId,
  isTerminalLocalStatus,
  isTerminalServerStatus,
  resolveTourEntry,
  selectAvailableSteps,
  type OnboardingLocalState,
} from "./tour-state";

const DISCOVER_FIRST = "discover-companion";
const CHAT_FIRST = "chat-sentence-card";

function localState(
  overrides: Partial<OnboardingLocalState> = {},
): OnboardingLocalState {
  return {
    version: 1,
    status: "active",
    phase: "discover",
    stepId: DISCOVER_FIRST,
    feedbackHintPending: false,
    updatedAt: 1,
    ...overrides,
  };
}

function entry(args: {
  serverStatus?: "pending" | "discover_done" | "completed" | "skipped";
  route?: "discover" | "chat" | null;
  local?: OnboardingLocalState | null;
}) {
  return resolveTourEntry({
    serverStatus: args.serverStatus,
    route: args.route ?? null,
    local: args.local ?? null,
    discoverFirstStepId: DISCOVER_FIRST,
    chatFirstStepId: CHAT_FIRST,
  });
}

test("starts the discover tour for a pending user with no local progress", () => {
  assert.deepEqual(entry({ serverStatus: "pending", route: "discover" }), {
    phase: "discover",
    stepId: DISCOVER_FIRST,
  });
});

test("starts the chat tour directly for a pending user on a chat route", () => {
  assert.deepEqual(entry({ serverStatus: "pending", route: "chat" }), {
    phase: "chat",
    stepId: CHAT_FIRST,
  });
});

test("does not show discover after discover_done", () => {
  assert.equal(
    entry({ serverStatus: "discover_done", route: "discover" }),
    null,
  );
});

test("continues to chat after discover_done", () => {
  assert.deepEqual(
    entry({ serverStatus: "discover_done", route: "chat" }),
    { phase: "chat", stepId: CHAT_FIRST },
  );
});

test("resumes the saved discover step", () => {
  assert.deepEqual(
    entry({
      serverStatus: "pending",
      route: "discover",
      local: localState({ stepId: "discover-story" }),
    }),
    { phase: "discover", stepId: "discover-story" },
  );
});

test("does not replay discover when local progress is already in chat", () => {
  assert.equal(
    entry({
      serverStatus: "pending",
      route: "discover",
      local: localState({ phase: "chat", stepId: CHAT_FIRST }),
    }),
    null,
  );
});

test("entering chat from an unfinished discover phase starts the chat tour", () => {
  assert.deepEqual(
    entry({
      serverStatus: "pending",
      route: "chat",
      local: localState({ stepId: "discover-story" }),
    }),
    { phase: "chat", stepId: CHAT_FIRST },
  );
});

test("terminal server states suppress the tour", () => {
  assert.equal(entry({ serverStatus: "completed", route: "discover" }), null);
  assert.equal(entry({ serverStatus: "skipped", route: "chat" }), null);
});

test("terminal local states suppress the tour", () => {
  assert.equal(
    entry({
      serverStatus: "pending",
      route: "discover",
      local: localState({ status: "skipped" }),
    }),
    null,
  );
  assert.equal(
    entry({
      serverStatus: "discover_done",
      route: "chat",
      local: localState({ status: "completed", phase: "chat" }),
    }),
    null,
  );
});

test("missing server status suppresses the tour", () => {
  assert.equal(entry({ route: "discover" }), null);
});

test("terminal helpers detect terminal states", () => {
  assert.equal(isTerminalServerStatus(undefined), false);
  assert.equal(isTerminalServerStatus("pending"), false);
  assert.equal(isTerminalServerStatus("discover_done"), false);
  assert.equal(isTerminalServerStatus("completed"), true);
  assert.equal(isTerminalServerStatus("skipped"), true);
  assert.equal(isTerminalLocalStatus("active"), false);
  assert.equal(isTerminalLocalStatus("completed"), true);
  assert.equal(isTerminalLocalStatus("skipped"), true);
});

test("adjacent step ids handle both ends", () => {
  const ids = ["a", "b", "c"];
  assert.equal(getAdjacentStepId(ids, "a", 1), "b");
  assert.equal(getAdjacentStepId(ids, "b", 1), "c");
  assert.equal(getAdjacentStepId(ids, "c", 1), null);
  assert.equal(getAdjacentStepId(ids, "b", -1), "a");
  assert.equal(getAdjacentStepId(ids, "a", -1), null);
  assert.equal(getAdjacentStepId(ids, "missing", 1), "a");
});

test("selectAvailableSteps keeps only available steps", () => {
  const steps = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const result = selectAvailableSteps(
    steps,
    (step) => step.id !== "b",
  );
  assert.deepEqual(
    result.map((step) => step.id),
    ["a", "c"],
  );
});
