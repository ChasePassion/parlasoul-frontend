import { NextRequest, NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { SUMMARY_FIELDS } from "@/lib/logger/format";

export const runtime = "nodejs";

const LOG_DIR = path.join(process.cwd(), "logs");
const RESOLVED_LOG_DIR = path.resolve(LOG_DIR);

const ALLOWED_MODULES = new Set(["character", "realtime", "voice"]);
const ALLOWED_LEVELS = new Set(["DEBUG", "INFO", "WARN", "ERROR"]);

const MAX_BODY_BYTES = 16 * 1024;
const MAX_EVENT_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_FIELD_LENGTH = 1000;

function sanitizeLogValue(value: unknown, maxLength = MAX_FIELD_LENGTH): string {
  return String(value ?? "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, maxLength);
}

function resolveLogFile(module: string): string {
  const logFile = path.resolve(RESOLVED_LOG_DIR, `${module}.log`);
  const relative = path.relative(RESOLVED_LOG_DIR, logFile);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid log path");
  }

  return logFile;
}

function formatLogLine(entry: Record<string, unknown>): string | null {
  const { module, ts, level, event, message, ...extra } = entry;

  if (typeof module !== "string" || !ALLOWED_MODULES.has(module)) return null;

  const safeLevel =
    typeof level === "string" && ALLOWED_LEVELS.has(level) ? level : "INFO";

  const fields = [
    `ts=${sanitizeLogValue(ts || new Date().toISOString().slice(0, 19).replace("T", " "))}`,
    `level=${safeLevel}`,
    `module=${module}`,
    `event=${sanitizeLogValue(event, MAX_EVENT_LENGTH)}`,
    `message=${JSON.stringify(sanitizeLogValue(message, MAX_MESSAGE_LENGTH))}`,
  ];

  for (const field of SUMMARY_FIELDS) {
    if (extra[field] !== undefined) {
      fields.push(`${field}=${JSON.stringify(sanitizeLogValue(extra[field]))}`);
    }
  }

  return fields.join(" ");
}

async function readJsonArrayOrObject(
  request: NextRequest,
): Promise<Record<string, unknown>[]> {
  const contentLength = request.headers.get("content-length");

  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new Error("Payload too large");
  }

  const text = await request.text();

  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error("Payload too large");
  }

  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function POST(request: NextRequest) {
  try {
    const entries = await readJsonArrayOrObject(request);

    // Group by module so each file append is a single write.
    const byModule = new Map<string, string[]>();
    let accepted = 0;

    for (const entry of entries) {
      const line = formatLogLine(entry);
      if (!line) continue;
      accepted++;
      const mod = entry.module as string;
      let lines = byModule.get(mod);
      if (!lines) {
        lines = [];
        byModule.set(mod, lines);
      }
      lines.push(line);
    }

    if (accepted > 0) {
      await mkdir(RESOLVED_LOG_DIR, { recursive: true });
      for (const [mod, lines] of byModule) {
        const logFile = resolveLogFile(mod);
        await appendFile(logFile, `${lines.join("\n")}\n`, "utf8");
      }
    }

    return NextResponse.json({ success: true, accepted });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";

    if (msg === "Payload too large") {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    return NextResponse.json({ error: "Failed to write log" }, { status: 500 });
  }
}
