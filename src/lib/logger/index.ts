import { formatEntry, formatHumanReadable } from "./format";
import type { LogEntry } from "./format";
import { ApiError } from "@/lib/token-store";

export { CharacterEvent, Module } from "./events";

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

function fetchTransport(entry: LogEntry): void {
  if (entry.level === "ERROR" || process.env.NODE_ENV === "development") {
    fetch(LOG_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }
}

const transports: Array<(entry: LogEntry) => void> = [
  consoleTransport,
  fetchTransport,
];

// ─── Emit ────────────────────────────────────────────────────────────────────

type LogLevel = "INFO" | "WARN" | "ERROR";

function emit(
  level: LogLevel,
  module: string,
  event: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  const entry = formatEntry(level, module, event, message, extra);
  transports.forEach((t) => t(entry));
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const logger = {
  info: (module: string, event: string, message: string, extra?: Record<string, unknown>) =>
    emit("INFO", module, event, message, extra),

  warn: (module: string, event: string, message: string, extra?: Record<string, unknown>) =>
    emit("WARN", module, event, message, extra),

  error: (module: string, event: string, message: string, extra?: Record<string, unknown>) =>
    emit("ERROR", module, event, message, extra),

  fromError: (module: string, err: unknown, event: string, extra?: Record<string, unknown>) => {
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
