import { createClient } from "redis";

type SharedRedisState = {
  client?: ReturnType<typeof createClient>;
  connectPromise?: Promise<ReturnType<typeof createClient>>;
};

const sharedRedisState = globalThis as typeof globalThis & {
  __parlaSoulRedisState?: SharedRedisState;
};

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error("Missing REDIS_URL for email OTP delivery status.");
  }
  return redisUrl;
}

function getSharedRedisState(): SharedRedisState {
  if (!sharedRedisState.__parlaSoulRedisState) {
    sharedRedisState.__parlaSoulRedisState = {};
  }
  return sharedRedisState.__parlaSoulRedisState;
}

function createRedisConnection(): ReturnType<typeof createClient> {
  const client = createClient({
    url: getRedisUrl(),
  });
  client.on("error", (error) => {
    console.error("Redis client error:", error);
  });
  return client;
}

export async function getRedisClient(): Promise<ReturnType<typeof createClient>> {
  const state = getSharedRedisState();

  if (!state.client) {
    state.client = createRedisConnection();
  }

  if (state.client.isReady) {
    return state.client;
  }

  if (!state.connectPromise) {
    state.connectPromise = state.client.connect().then(() => state.client!);
  }

  try {
    return await state.connectPromise;
  } catch (error) {
    state.client = undefined;
    throw error;
  } finally {
    state.connectPromise = undefined;
  }
}
