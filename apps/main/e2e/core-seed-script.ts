import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Runs one of core's seed scripts (`packages/core/scripts/seed`) on the test run's database, in a
 * process of its own: Playwright can't load core's server code, the planner included.
 */
export async function runCoreSeedScript(script: string, args: readonly string[]): Promise<void> {
  await execFileAsync(
    "pnpm",
    [
      "--filter",
      "@zoonk/core",
      "--silent",
      "exec",
      "tsx",
      "--conditions=react-server",
      "--import=./scripts/seed/node-runtime.mjs",
      `scripts/seed/${script}`,
      ...args,
    ],
    { env: { ...process.env, NEXT_PUBLIC_APP_DOMAIN: "localhost:3000" } },
  );
}
