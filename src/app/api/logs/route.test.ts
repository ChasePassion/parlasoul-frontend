import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { NextRequest } from "next/server";

import { POST } from "./route";

function withLogCwd(run: (logDir: string) => Promise<void>): Promise<void> {
  const originalCwd = process.cwd();
  const workDir = mkdtempSync(path.join(tmpdir(), "parlasoul-logs-"));
  const logDir = path.join(workDir, "logs");

  process.chdir(workDir);

  return run(logDir).finally(() => {
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
  });
}

function postJson(payload: unknown): Promise<Response> {
  return POST(
    new NextRequest("http://localhost/api/logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

test("rejects payloads above the body limit with 413", async () => {
  await withLogCwd(async () => {
    const response = await postJson({
      module: "character",
      event: "large",
      message: "a".repeat(20 * 1024),
    });

    assert.equal(response.status, 413);
  });
});

test("writes sanitized single-line entries for allowed modules", async () => {
  await withLogCwd(async (logDir) => {
    const response = await postJson({
      module: "character",
      ts: "2026-01-01 00:00:00",
      level: "HACK",
      event: "line1\nline2",
      message: "hello\r\nworld",
      request_id: "req-1",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, accepted: 1 });

    const content = readFileSync(path.join(logDir, "character.log"), "utf8");
    assert.equal(content.trimEnd().split("\n").length, 1);
    assert.equal(content.includes("\r"), false);
    assert.equal(content.includes("level=INFO"), true);
    assert.equal(content.includes("event=line1 line2"), true);
  });
});

test("drops entries whose module is not allowlisted", async () => {
  await withLogCwd(async (logDir) => {
    const response = await postJson({
      module: "../../etc/passwd",
      event: "traversal",
      message: "ignored",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, accepted: 0 });

    if (existsSync(logDir)) {
      const entries = readdirSync(logDir).filter((name) => name.endsWith(".log"));
      assert.equal(entries.length, 0);
    }
  });
});
