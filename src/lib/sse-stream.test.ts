import assert from "node:assert/strict";
import test from "node:test";

import { consumeSseStream, handleStreamError } from "./sse-stream";
import { ApiError, UnauthorizedError } from "./token-store";

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    {
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

test("consumeSseStream parses data rows split across chunks and skips malformed rows", async () => {
  const events: Array<{ type: string; content?: string }> = [];

  await consumeSseStream<{ type: string; content?: string }>(
    createSseResponse([
      'data: {"type":"chunk","content":"hel',
      'lo"}\n',
      "event: ignored\n",
      "data: not-json\n",
      'data: {"type":"done"}\n\n',
    ]),
    (event) => events.push(event),
  );

  assert.deepEqual(events, [
    { type: "chunk", content: "hello" },
    { type: "done" },
  ]);
});

test("consumeSseStream flushes the final data row when the stream closes without a newline", async () => {
  const events: Array<{ type: string; full_content?: string }> = [];

  await consumeSseStream<{ type: string; full_content?: string }>(
    createSseResponse(['data: {"type":"done","full_content":"final"}']),
    (event) => events.push(event),
  );

  assert.deepEqual(events, [{ type: "done", full_content: "final" }]);
});

test("consumeSseStream rejects responses without a readable body", async () => {
  await assert.rejects(
    () => consumeSseStream(new Response(null), () => {}),
    /No response body/,
  );
});

test("handleStreamError keeps aborts silent and maps unauthorized errors to friendly messages", () => {
  const errors: Error[] = [];

  handleStreamError(new DOMException("aborted", "AbortError"), (error) => {
    errors.push(error);
  });
  handleStreamError(new UnauthorizedError(), (error) => {
    errors.push(error);
  });

  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, "登录已过期，请重新登录");
});

test("handleStreamError can preserve legacy chat stream ApiError wrapping", () => {
  const errors: Error[] = [];

  handleStreamError(
    new ApiError(409, "resource_conflict", "character is unpublished"),
    (error) => {
      errors.push(error);
    },
    { apiErrorMode: "detail-error" },
  );

  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, "Error");
  assert.equal(errors[0].message, "character is unpublished");
});

test("handleStreamError passes ApiError through by default", () => {
  const errors: Error[] = [];

  const apiError = new ApiError(500, "llm_service_error", "upstream failed");
  handleStreamError(apiError, (error) => {
    errors.push(error);
  });

  assert.equal(errors[0], apiError);
});
