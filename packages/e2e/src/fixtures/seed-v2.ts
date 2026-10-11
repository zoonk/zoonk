import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type SeedPersonaName } from "@zoonk/db/seed/v2/personas";
import { isJsonObject } from "@zoonk/utils/json";

const execFileAsync = promisify(execFile);

/** Room for what the seed command prints: a copy is one line of JSON, the rest is logging. */
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

/**
 * Runs core's v2 seed command (`pnpm seed:v2` in `@zoonk/core`) on the test run's database. The
 * planner that lays out the seeded plans is core's server code, which Playwright can't load, so it
 * runs in its own process. Returns what it printed.
 */
async function runSeedV2(args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["--filter", "@zoonk/core", "--silent", "seed:v2", ...args],
    { maxBuffer: MAX_OUTPUT_BYTES },
  );

  return stdout;
}

/** Seeds the v2 Library and personas with the plans the planner makes (see `seedV2` in core). */
export async function seedV2(): Promise<void> {
  await runSeedV2([]);
}

/**
 * Writes a private copy of a v2 persona with the plan the planner makes for it (see
 * `seedV2PersonaCopy` in core).
 */
export async function seedV2PersonaCopy({
  away,
  copyKey,
  day,
  email,
  persona,
}: {
  /** Days the copy has been away without studying (see `writeSeedV2PersonaCopy`). */
  away?: number;
  copyKey: string;
  /** The day of its plan the copy is on (see `writeSeedV2PersonaCopy`); its own when absent. */
  day?: number;
  email: string;
  persona: SeedPersonaName;
}): Promise<{ goalId: string; userId: string }> {
  const output = await runSeedV2([
    "--persona",
    persona,
    "--copy-key",
    copyKey,
    "--email",
    email,
    ...(day === undefined ? [] : ["--day", String(day)]),
    ...(away === undefined ? [] : ["--away", String(away)]),
  ]);

  const copy: unknown = JSON.parse(output.trim().split("\n").at(-1) ?? "null");

  if (!isJsonObject(copy) || typeof copy.goalId !== "string" || typeof copy.userId !== "string") {
    throw new Error(`The seed command wrote no copy of ${persona}: ${output}`);
  }

  return { goalId: copy.goalId, userId: copy.userId };
}
