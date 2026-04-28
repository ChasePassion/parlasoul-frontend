import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));

function collectTests(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const tests = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      tests.push(...collectTests(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      tests.push(fullPath);
    }
  }

  return tests;
}

if (!statSync(srcDir).isDirectory()) {
  console.error(`Test source directory does not exist: ${srcDir}`);
  process.exit(1);
}

const tests = collectTests(srcDir).sort();

if (tests.length === 0) {
  console.error("No test files found under src.");
  process.exit(1);
}

const child = spawn(process.execPath, ["--import", "tsx", "--test", ...tests], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
