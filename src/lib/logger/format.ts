export interface LogEntry {
  ts: string;
  level: "INFO" | "WARN" | "ERROR";
  module: string;
  event: string;
  message: string;
  [key: string]: unknown;
}

export const SUMMARY_FIELDS = [
  "event",
  "character_id",
  "error_status",
  "error_code",
  "elapsed_ms",
  "user_id",
  "mode",
] as const;

export function formatEntry(
  level: LogEntry["level"],
  module: string,
  event: string,
  message: string,
  extra?: Record<string, unknown>
): LogEntry {
  return {
    ts: new Date().toISOString().slice(0, 19).replace("T", " "),
    level,
    module,
    event,
    message,
    ...extra,
  };
}

export function formatHumanReadable(entry: LogEntry): string {
  const parts = [`[${entry.ts}]`, `[${entry.level}]`, `[${entry.module}]`, entry.message];

  for (const field of SUMMARY_FIELDS) {
    if (entry[field] !== undefined) {
      parts.push(`[${field}=${entry[field]}]`);
    }
  }

  return parts.join(" ");
}
