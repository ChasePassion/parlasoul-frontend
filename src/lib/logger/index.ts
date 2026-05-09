import { formatEntry, formatHumanReadable } from "./format";
import type { LogEntry } from "./format";
import type { ModuleType } from "./events";
import { ApiError } from "@/lib/token-store";

export { CharacterEvent, Module, RealtimeEvent, AuthEvent, TtsEvent, ScrollEvent } from "./events";
export type { ModuleType } from "./events";

// ─── Transports ────────────────────────────────────────────────────────────────

function consoleTransport(entry: LogEntry): void {
  const readable = formatHumanReadable(entry);
  if (entry.level === "ERROR") {
    console.error(readable, entry);
  } else if (entry.level === "WARN") {
    console.warn(readable, entry);
  } else {
    console.log(readable, entry);
  }
}

const LOG_API = "/api/logs";
const LOG_BATCH_SIZE = 20;
const LOG_FLUSH_MS = 500;

const batchBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushBatch(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (batchBuffer.length === 0) return;
  const batch = batchBuffer.splice(0);
  fetch(LOG_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  }).catch(() => {});
}

function batchFetchTransport(entry: LogEntry): void {
  if (entry.level !== "ERROR" && process.env.NODE_ENV !== "development") return;
  batchBuffer.push(entry);
  if (batchBuffer.length >= LOG_BATCH_SIZE) {
    flushBatch();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushBatch, LOG_FLUSH_MS);
  }
}

const transports: Array<(entry: LogEntry) => void> = [
  consoleTransport,
  batchFetchTransport,
];

// ─── Emit ────────────────────────────────────────────────────────────────────

type LogLevel = "INFO" | "WARN" | "ERROR";

function emit(
  level: LogLevel,
  module: ModuleType,
  event: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  const entry = formatEntry(level, module, event, message, extra);
  transports.forEach((t) => t(entry));
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const logger = {
  info: (module: ModuleType, event: string, message: string, extra?: Record<string, unknown>) =>
    emit("INFO", module, event, message, extra),

  warn: (module: ModuleType, event: string, message: string, extra?: Record<string, unknown>) =>
    emit("WARN", module, event, message, extra),

  error: (module: ModuleType, event: string, message: string, extra?: Record<string, unknown>) =>
    emit("ERROR", module, event, message, extra),

  fromError: (module: ModuleType, err: unknown, event: string, extra?: Record<string, unknown>) => {
    if (err instanceof ApiError) {
      emit("ERROR", module, event, `API Error ${err.status}: ${err.detail || err.message}`, {
        error_status: err.status,
        error_code: err.code,
        error_detail: err.detail,
        ...extra,
      });
    } else if (err instanceof Error) {
      emit("ERROR", module, event, err.message, {
        error_type: err.name,
        ...extra,
      });
    } else {
      emit("ERROR", module, event, String(err), extra);
    }
  },
};
