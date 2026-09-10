import { createRequire } from "node:module";
import { resolve } from "node:path";
import { getTestEnvironment } from "../packages/db/src/test-environment.ts";
import { applyCommandExit, runForegroundCommand } from "./dev/process.mts";

const [mode, command, ...args] = process.argv.slice(2);

if ((mode !== "test" && mode !== "e2e") || !command) {
  throw new Error("Usage: node scripts/run-test-env.mts <test|e2e> <command> [arguments]");
}

/** Run package entrypoints with Node directly; Windows cannot spawn their .cmd shims. */
const entrypoints: Record<string, string> = {
  next: "next/dist/bin/next",
  playwright: "@playwright/test/cli",
  prisma: "prisma/build/index.js",
};

const entrypoint = entrypoints[command];
const requireCommand = createRequire(resolve("package.json"));

applyCommandExit(
  await runForegroundCommand({
    args: entrypoint ? [requireCommand.resolve(entrypoint), ...args] : args,
    command: entrypoint ? process.execPath : command,
    currentDirectory: process.cwd(),
    environment: { ...process.env, ...getTestEnvironment(mode) },
  }),
);
