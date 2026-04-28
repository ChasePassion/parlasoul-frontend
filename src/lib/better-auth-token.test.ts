import assert from "node:assert/strict";
import test from "node:test";

import {
  clearBetterAuthJwt,
  fetchWithBetterAuth,
  getBetterAuthJwt,
} from "./better-auth-token";

function createJwt(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString(
    "base64url",
  );
  return `header.${payload}.signature`;
}

function getRequestPath(input: RequestInfo | URL): string {
  const value =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return new URL(value, "http://localhost").pathname;
}

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setFetch(handler: typeof fetch): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("caches the Better Auth JWT until it is close to expiry", async () => {
  clearBetterAuthJwt();
  const token = createJwt(Math.floor(Date.now() / 1000) + 600);
  let tokenRequests = 0;
  const restoreFetch = setFetch(async (input) => {
    assert.equal(getRequestPath(input), "/api/auth/token");
    tokenRequests += 1;
    return createJsonResponse({ token });
  });

  try {
    assert.equal(await getBetterAuthJwt(), token);
    assert.equal(await getBetterAuthJwt(), token);
    assert.equal(tokenRequests, 1);
  } finally {
    clearBetterAuthJwt();
    restoreFetch();
  }
});

test("deduplicates concurrent JWT refresh requests", async () => {
  clearBetterAuthJwt();
  const token = createJwt(Math.floor(Date.now() / 1000) + 600);
  let tokenRequests = 0;
  const restoreFetch = setFetch(async (input) => {
    assert.equal(getRequestPath(input), "/api/auth/token");
    tokenRequests += 1;
    await Promise.resolve();
    return createJsonResponse({ token });
  });

  try {
    const results = await Promise.all([
      getBetterAuthJwt(),
      getBetterAuthJwt(),
      getBetterAuthJwt(),
    ]);

    assert.deepEqual(results, [token, token, token]);
    assert.equal(tokenRequests, 1);
  } finally {
    clearBetterAuthJwt();
    restoreFetch();
  }
});

test("retries a 401 response once when a fresh JWT is available", async () => {
  clearBetterAuthJwt();
  const oldToken = createJwt(Math.floor(Date.now() / 1000) + 600);
  const newToken = createJwt(Math.floor(Date.now() / 1000) + 700);
  const issuedTokens = [oldToken, newToken];
  const seenAuthorization: Array<string | null> = [];
  const restoreFetch = setFetch(async (input, init) => {
    const path = getRequestPath(input);

    if (path === "/api/auth/token") {
      return createJsonResponse({ token: issuedTokens.shift() ?? null });
    }

    assert.equal(path, "/v1/protected");
    const headers = new Headers(init?.headers);
    seenAuthorization.push(headers.get("Authorization"));

    if (seenAuthorization.length === 1) {
      return createJsonResponse({ code: "unauthorized" }, 401);
    }

    return createJsonResponse({ code: "ok" });
  });

  try {
    const response = await fetchWithBetterAuth("/v1/protected");

    assert.equal(response.status, 200);
    assert.deepEqual(seenAuthorization, [
      `Bearer ${oldToken}`,
      `Bearer ${newToken}`,
    ]);
  } finally {
    clearBetterAuthJwt();
    restoreFetch();
  }
});

test("does not retry a 401 response when the refreshed JWT is unchanged", async () => {
  clearBetterAuthJwt();
  const token = createJwt(Math.floor(Date.now() / 1000) + 600);
  let fetchCalls = 0;
  const restoreFetch = setFetch(async (input) => {
    const path = getRequestPath(input);

    if (path === "/api/auth/token") {
      return createJsonResponse({ token });
    }

    assert.equal(path, "/v1/protected");
    fetchCalls += 1;
    return createJsonResponse({ code: "unauthorized" }, 401);
  });

  try {
    const response = await fetchWithBetterAuth("/v1/protected");

    assert.equal(response.status, 401);
    assert.equal(fetchCalls, 1);
  } finally {
    clearBetterAuthJwt();
    restoreFetch();
  }
});
