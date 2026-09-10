import { getTestEnvironment } from "../packages/db/src/test-environment.ts";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./dev/process.mts";

const [mode, command, ...args] = process.argv.slice(2);

if ((mode !== "test" && mode !== "e2e") || !command) {
  throw new Error("Usage: node scripts/run-test-env.mts <test|e2e> <command> [arguments]");
}

/** Let pnpm resolve platform-specific shims and preserve their module search paths. */
const pnpm = getPnpmCommand(process.env);

applyCommandExit(
  await runForegroundCommand({
    args: [...pnpm.args, "exec", command, ...args],
    command: pnpm.command,
    currentDirectory: process.cwd(),
    environment: { ...process.env, ...getTestEnvironment(mode) },
  }),
);
