import { closeSync, createReadStream, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { getTestEnvironment } from "../packages/db/src/test-environment.ts";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./dev/process.mts";
import { waitForTurn } from "./dev/queue.mts";

const [mode, ...commandLine] = process.argv.slice(2);
const quietOnSuccess = commandLine[0] === "--quiet-on-success";
const [command, ...args] = quietOnSuccess ? commandLine.slice(1) : commandLine;

if ((mode !== "test" && mode !== "e2e") || !command) {
  throw new Error(
    "Usage: node scripts/run-test-env.mts <test|e2e> [--quiet-on-success] <command> [arguments]",
  );
}

const pnpm = getPnpmCommand(process.env);
const turn = await waitForTurn();

const options = {
  args: [...pnpm.args, "exec", command, ...args],
  command: pnpm.command,
  currentDirectory: process.cwd(),
  environment: { ...process.env, ...getTestEnvironment(mode), ...turn?.environment },
};

if (quietOnSuccess) {
  const directory = mkdtempSync(join(tmpdir(), "zoonk-test-setup-"));

  try {
    const path = join(directory, "output");
    const output = openSync(path, "w");

    const result = await runForegroundCommand({
      ...options,
      stdio: ["inherit", output, output],
    }).finally(() => closeSync(output));

    if (result.code !== 0) {
      await pipeline(createReadStream(path), process.stderr, { end: false });
    }

    applyCommandExit(result);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
} else {
  applyCommandExit(await runForegroundCommand(options));
}
