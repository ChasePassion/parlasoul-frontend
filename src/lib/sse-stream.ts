import { ApiError, UnauthorizedError } from "./token-store";
import { getErrorMessage } from "./error-map";

/**
 * Parse SSE events from a fetch Response and invoke a callback for each parsed event.
 *
 * Handles the standard SSE wire format:
 * - Lines prefixed with `data:` are parsed as JSON.
 * - Empty lines are used as event separators (ignored).
 * - Lines without the `data:` prefix are skipped.
 * - Malformed JSON payloads are silently ignored.
 */
export async function consumeSseStream<T>(
  response: Response,
  onEvent: (event: T) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let pending = "";

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;

    const payload = trimmed.slice(5).trim();
    if (!payload) return;

    let parsed: T;
    try {
      parsed = JSON.parse(payload) as T;
    } catch {
      return; // malformed JSON, skip this event
    }
    onEvent(parsed); // handler exceptions propagate to caller
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";

    lines.forEach(processLine);
  }

  pending += decoder.decode();
  if (pending) {
    pending.split("\n").forEach(processLine);
  }
}

/**
 * Standardized error handling for SSE streaming methods.
 *
 * Routes different error types to the `onError` callback:
 * - AbortError: silently ignored (user-initiated cancellation).
 * - UnauthorizedError: wrapped with a user-friendly message.
 * - ApiError: passed through directly so callers can inspect `.code` / `.status`.
 * - Other errors: wrapped in an Error instance.
 */
interface StreamErrorOptions {
  apiErrorMode?: "pass-through" | "detail-error";
}

export function handleStreamError(
  error: unknown,
  onError: (error: Error) => void,
  options: StreamErrorOptions = {},
): void {
  if (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return;
  }

  if (error instanceof UnauthorizedError) {
    onError(new Error(getErrorMessage(error)));
    return;
  }

  if (error instanceof ApiError) {
    if (options.apiErrorMode === "detail-error") {
      onError(new Error(error.detail || `API error: ${error.status}`));
    } else {
      onError(error);
    }
    return;
  }

  onError(error instanceof Error ? error : new Error("Unknown error"));
}
