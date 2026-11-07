import assert from "node:assert/strict";
import test from "node:test";

import {
  LOADING_TIMING,
  clearChatEntrySeed,
  clearCharacterSeed,
  isTerminalLoadingError,
  loadingTierFor,
  readCharacterSeed,
  readChatEntrySeed,
  seedCharacterEntry,
  seedChatEntry,
} from "./loading";
import { ApiError, UnauthorizedError } from "./token-store";

// 种子读写走 localStorage；Node 测试里提供一个最小内存实现。
function installLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    },
  });
}

installLocalStorage();

const SAMPLE = {
  id: "char-1",
  name: "Test Character",
  description: "desc",
  avatar_image_key: null,
  avatar_urls: null,
};

test("loading tiers follow the timing thresholds", () => {
  assert.equal(loadingTierFor(0), "none");
  assert.equal(loadingTierFor(LOADING_TIMING.acknowledgementMs - 1), "none");
  assert.equal(loadingTierFor(LOADING_TIMING.acknowledgementMs), "acknowledgement");
  assert.equal(loadingTierFor(LOADING_TIMING.indicatorDelayMs), "short");
  assert.equal(loadingTierFor(LOADING_TIMING.skeletonThresholdMs), "skeleton");
  assert.equal(loadingTierFor(LOADING_TIMING.longWaitMs), "long");
  assert.equal(loadingTierFor(60_000), "long");
});

test("thresholds are strictly increasing", () => {
  const values = [
    LOADING_TIMING.acknowledgementMs,
    LOADING_TIMING.indicatorDelayMs,
    LOADING_TIMING.skeletonThresholdMs,
    LOADING_TIMING.longWaitMs,
  ];
  assert.ok(values.every((value, index) => index === 0 || value > values[index - 1]));
});

test("character seed survives login (queryClient.clear equivalent)", () => {
  seedCharacterEntry(SAMPLE);
  const character = readCharacterSeed("char-1");
  assert.ok(character);
  assert.equal(character.id, "char-1");
  assert.equal(character.name, "Test Character");
  clearCharacterSeed("char-1");
  assert.equal(readCharacterSeed("char-1"), null);
});

test("chat entry seed can be migrated from character seed", () => {
  seedCharacterEntry(SAMPLE);
  const character = readCharacterSeed("char-1");
  assert.ok(character);
  seedChatEntry("chat-1", character);

  const migrated = readChatEntrySeed("chat-1");
  assert.ok(migrated);
  assert.equal(migrated.id, "char-1");
  assert.equal(migrated.name, "Test Character");

  clearChatEntrySeed("chat-1");
  clearCharacterSeed("char-1");
  assert.equal(readChatEntrySeed("chat-1"), null);
});

test("missing or expired seed returns null", () => {
  assert.equal(readCharacterSeed(null), null);
  assert.equal(readChatEntrySeed(undefined), null);
  assert.equal(readCharacterSeed("missing"), null);
  assert.equal(readChatEntrySeed("missing"), null);
});

test("transient failures are retryable, terminal 4xx are not", () => {
  // 瞬时故障：网络错误、5xx、401/408/429
  assert.equal(isTerminalLoadingError(new Error("fetch failed")), false);
  assert.equal(isTerminalLoadingError(new ApiError(500)), false);
  assert.equal(isTerminalLoadingError(new ApiError(503)), false);
  assert.equal(isTerminalLoadingError(new ApiError(401)), false);
  assert.equal(isTerminalLoadingError(new ApiError(408)), false);
  assert.equal(isTerminalLoadingError(new ApiError(429)), false);
  assert.equal(isTerminalLoadingError(new UnauthorizedError()), false);

  // 终态：明确不可恢复的 4xx
  assert.equal(isTerminalLoadingError(new ApiError(400)), true);
  assert.equal(isTerminalLoadingError(new ApiError(403)), true);
  assert.equal(isTerminalLoadingError(new ApiError(404)), true);
  assert.equal(isTerminalLoadingError(new ApiError(422)), true);
});

