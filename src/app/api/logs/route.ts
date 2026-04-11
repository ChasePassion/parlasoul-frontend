import { NextRequest, NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { SUMMARY_FIELDS } from "@/lib/logger/format";

const LOG_DIR = path.join(process.cwd(), "logs");

export async function POST(request: NextRequest) {
  try {
    const entry = await request.json();

    const { module, ts, level, event, message, ...extra } = entry;

    const fields = [
      `ts=${ts || new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      `level=${level || "INFO"}`,
      `module=${module}`,
      `event=${event}`,
      `message="${message || ""}"`,
    ];

    for (const field of SUMMARY_FIELDS) {
      if (extra[field] !== undefined) {
        fields.push(`${field}=${extra[field]}`);
      }
    }

    const logFile = path.join(LOG_DIR, `${module}.log`);
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(logFile, `${fields.join(" ")}\n`, "utf8");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to write log" }, { status: 500 });
  }
}
