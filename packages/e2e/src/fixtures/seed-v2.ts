import { type ChildProcessWithoutNullStreams, execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
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

type CopyAnswer = { copy?: unknown; error?: string; id: string };

/**
 * This process's copy writer: core's seed command kept open with `--serve`, answering one request
 * a line. Starting that command is nearly all a copy costs, so a Playwright worker starts it once,
 * and it ends with the worker, whose exit closes its stdin.
 */
const copyWriter: {
  answers: Map<string, (answer: CopyAnswer) => void>;
  process: ChildProcessWithoutNullStreams | null;
} = { answers: new Map(), process: null };

function readJsonLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function startCopyWriter(): ChildProcessWithoutNullStreams {
  const child = spawn("pnpm", ["--filter", "@zoonk/core", "--silent", "seed:v2", "--serve"]);

  // Lines without a waiting request's id are the seed's own logging.
  createInterface({ input: child.stdout }).on("line", (line) => {
    const answer = readJsonLine(line);
    const id = isJsonObject(answer) && typeof answer.id === "string" ? answer.id : null;
    const deliver = id ? copyWriter.answers.get(id) : undefined;

    if (id && deliver) {
      copyWriter.answers.delete(id);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- core's `serveCopies` writes this exact answer shape.
      deliver(answer as CopyAnswer);
    }
  });

  child.stderr.pipe(process.stderr);

  child.once("exit", (code) => {
    copyWriter.process = null;

    for (const deliver of copyWriter.answers.values()) {
      deliver({ error: `The seed command exited (${code}).`, id: "" });
    }

    copyWriter.answers.clear();
  });

  return child;
}

/** Asks this process's copy writer for a persona copy, starting it the first time. */
async function requestCopy(request: Record<string, string | undefined>): Promise<unknown> {
  copyWriter.process ??= startCopyWriter();
  const id = randomUUID();

  const answered = new Promise<CopyAnswer>((resolve) => {
    copyWriter.answers.set(id, resolve);
  });

  copyWriter.process.stdin.write(`${JSON.stringify({ ...request, id })}\n`);
  const answer = await answered;

  if (answer.error !== undefined) {
    throw new Error(answer.error);
  }

  return answer.copy;
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
  copyKey,
  email,
  persona,
}: {
  copyKey: string;
  email: string;
  persona: SeedPersonaName;
}): Promise<{ goalId: string; userId: string }> {
  const copy = await requestCopy({ copyKey, email, persona });

  if (!isJsonObject(copy) || typeof copy.goalId !== "string" || typeof copy.userId !== "string") {
    throw new Error(`The seed command wrote no copy of ${persona}: ${JSON.stringify(copy)}`);
  }

  return { goalId: copy.goalId, userId: copy.userId };
}
