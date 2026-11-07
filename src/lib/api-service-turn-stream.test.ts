import assert from "node:assert/strict";
import test from "node:test";

import { ApiService } from "./api-service";
import { clearBetterAuthJwt } from "./better-auth-token";
import { ApiError } from "./token-store";

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

function createSseResponse(events: unknown[]): Response {
  const body = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function installTurnStreamFetch(events: unknown[]): {
  restore: () => void;
  paths: string[];
} {
  clearBetterAuthJwt();
  const token = createJwt(Math.floor(Date.now() / 1000) + 600);
  const paths: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const path = getRequestPath(input);
    paths.push(path);

    if (path === "/api/auth/token") {
      return new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return createSseResponse(events);
  };

  return {
    restore: () => {
      globalThis.fetch = originalFetch;
      clearBetterAuthJwt();
    },
    paths,
  };
}

test("regen stream dispatches turn events through the shared consumer", async () => {
  const received: string[] = [];
  const { restore, paths } = installTurnStreamFetch([
    {
      type: "meta",
      assistant_turn: { id: "assistant-1", candidate_id: "candidate-1" },
    },
    { type: "chunk", content: "hel" },
    {
      type: "reply_suggestions",
      assistant_candidate_id: "candidate-1",
      suggestions: [{ type: "topic", en: "Go on", zh: "继续" }],
    },
    {
      type: "done",
      full_content: "hello",
      assistant_turn_id: "assistant-1",
      assistant_candidate_id: "candidate-1",
    },
  ]);

  try {
    await new ApiService().regenAssistantTurn("turn-1", {
      onMeta: (meta) => received.push(`meta:${meta.assistant_turn.id}`),
      onChunk: (content) => received.push(`chunk:${content}`),
      onReplySuggestions: (data) =>
        received.push(`suggestions:${data.suggestions.length}`),
      onDone: (fullContent, assistantTurnId, assistantCandidateId) =>
        received.push(
          `done:${fullContent}:${assistantTurnId}:${assistantCandidateId}`,
        ),
      onError: (error) => received.push(`error:${error.message}`),
    });
  } finally {
    restore();
  }

  assert.deepEqual(received, [
    "meta:assistant-1",
    "chunk:hel",
    "suggestions:1",
    "done:hello:assistant-1:candidate-1",
  ]);
  assert.deepEqual(paths, ["/api/auth/token", "/v1/turns/turn-1/regen/stream"]);
});

test("turn stream maps SSE error frames to ApiError with the backend code", async () => {
  const captured: { error: Error | null } = { error: null };
  const { restore } = installTurnStreamFetch([
    {
      type: "error",
      code: "llm_service_error",
      message: "upstream failed",
    },
  ]);

  try {
    await new ApiService().regenAssistantTurn("turn-1", {
      onChunk: () => {},
      onDone: () => {},
      onError: (error) => {
        captured.error = error;
      },
    });
  } finally {
    restore();
  }

  const capturedError = captured.error;
  assert.ok(capturedError instanceof ApiError);
  assert.equal(capturedError.status, 502);
  assert.equal(capturedError.code, "llm_service_error");
  assert.equal(capturedError.detail, "upstream failed");
});

test("edit stream forwards transform_done before the reply", async () => {
  const received: string[] = [];
  const { restore } = installTurnStreamFetch([
    {
      type: "transform_done",
      original_content: "raw",
      transformed_content: "polished",
      applied: true,
    },
    { type: "chunk", content: "ok" },
    {
      type: "done",
      full_content: "ok",
      assistant_turn_id: "assistant-1",
      assistant_candidate_id: "candidate-1",
    },
  ]);

  try {
    await new ApiService().editUserTurnAndStreamReply(
      "turn-1",
      { content: "raw" },
      {
        onTransformDone: (data) =>
          received.push(`transform:${data.transformed_content}:${data.applied}`),
        onChunk: (content) => received.push(`chunk:${content}`),
        onDone: (fullContent) => received.push(`done:${fullContent}`),
        onError: (error) => received.push(`error:${error.message}`),
      },
    );
  } finally {
    restore();
  }

  assert.deepEqual(received, [
    "transform:polished:true",
    "chunk:ok",
    "done:ok",
  ]);
});
