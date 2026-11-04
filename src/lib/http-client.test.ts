import assert from "node:assert/strict";
import test from "node:test";

import { clearBetterAuthJwt } from "./better-auth-token";
import {
  httpClient,
  parseJsonResponse,
  throwApiErrorResponse,
  unwrapEnvelopePayload,
} from "./http-client";
import { ApiError, UnauthorizedError } from "./token-store";

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

test("unwraps standard /v1 success envelopes and leaves raw payloads intact", () => {
  assert.deepEqual(
    unwrapEnvelopePayload<{ status: string }>({
      code: "ok",
      message: "ok",
      status: 200,
      data: { status: "ok" },
    }),
    { status: "ok" },
  );
  assert.deepEqual(unwrapEnvelopePayload({ direct: true }), { direct: true });
});

test("parses invalid JSON responses as undefined", async () => {
  const response = new Response("not-json", { status: 200 });

  assert.equal(await parseJsonResponse(response), undefined);
});

test("throws UnauthorizedError and clears JWT state for 401 responses", async () => {
  clearBetterAuthJwt();
  await assert.rejects(
    () =>
      throwApiErrorResponse(
        new Response(
          JSON.stringify({
            code: "unauthorized",
            message: "authorization failed",
          }),
          { status: 401 },
        ),
      ),
    UnauthorizedError,
  );
});

test("throws ApiError with response code and message for non-401 errors", async () => {
  await assert.rejects(
    () =>
      throwApiErrorResponse(
        new Response(
          JSON.stringify({
            code: "resource_not_found",
            message: "missing character",
          }),
          { status: 404 },
        ),
      ),
    (error) =>
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === "resource_not_found" &&
      error.detail === "missing character",
  );
});

test("sends JSON requests through Better Auth and unwraps response data", async () => {
  clearBetterAuthJwt();
  const seenPaths: string[] = [];
  const restoreFetch = setFetch(async (input, init) => {
    const path = getRequestPath(input);
    seenPaths.push(path);

    if (path === "/api/auth/token") {
      return createJsonResponse({ token: null });
    }

    assert.equal(path, "/v1/users/me/settings");
    assert.equal(init?.method, "PATCH");
    assert.equal(
      new Headers(init?.headers).get("Content-Type"),
      "application/json",
    );
    assert.equal(
      init?.body,
      JSON.stringify({ display_mode: "detailed" }),
    );

    return createJsonResponse({
      code: "ok",
      message: "ok",
      status: 200,
      data: { display_mode: "detailed" },
    });
  });

  try {
    const result = await httpClient.patch<
      { display_mode: string },
      { display_mode: string }
    >("/v1/users/me/settings", { display_mode: "detailed" });

    assert.deepEqual(result, { display_mode: "detailed" });
    assert.deepEqual(seenPaths, ["/api/auth/token", "/v1/users/me/settings"]);
  } finally {
    clearBetterAuthJwt();
    restoreFetch();
  }
});
