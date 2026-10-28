import "server-only";
import { type ChildProcess, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { PROGRAM_TIME_LIMIT_MS, type ProgramKind } from "./program-limits";
import { programRunnerSource } from "./program-runner-source";
import {
  type ProgramRun,
  type RunnerResult,
  runnerMessageSchema,
  toProgramRun,
} from "./program-runs";
import { type SqlStatement } from "./sql-setup";

export type ProgramJob =
  | { kind: "javascript"; code: string }
  | { kind: "python"; code: string; watch?: readonly string[] }
  | { kind: "sql"; query: string; setup: readonly SqlStatement[] };

const BOOT_TIMEOUT_MS = 30_000;
const RESULT_GRACE_MS = 1000;
const RUNNER_HEAP_MB = 256;
const STDERR_TAIL_LENGTH = 2000;

type RunnerReply = { kind: "exit" } | { kind: "line"; value: unknown } | { kind: "timeout" };

type Runner = {
  next: (timeoutMs: number) => Promise<RunnerReply>;
  send: (message: object) => void;
  stderr: () => string;
  stop: () => void;
};

/** Resolve through Node's runtime loader because bundlers replace imported `require.resolve` calls with module ids. */
function resolveRuntimes() {
  const { createRequire } = process.getBuiltinModule("node:module");
  const require = createRequire(import.meta.url);
  const pyodideEntry = require.resolve("pyodide");
  const sqlJsEntry = require.resolve("sql.js");
  const quickjsEntry = require.resolve("quickjs-wasi");
  const quickjsRoot = dirname(dirname(quickjsEntry));
  const wsRoot = dirname(createRequire(pyodideEntry).resolve("ws/package.json"));

  return {
    folders: [dirname(pyodideEntry), dirname(sqlJsEntry), quickjsRoot, wsRoot],
    paths: {
      pyodide: pathToFileURL(join(dirname(pyodideEntry), "pyodide.mjs")).href,
      quickjs: pathToFileURL(quickjsEntry).href,
      quickjsWasm: join(quickjsRoot, "quickjs.wasm"),
      sqlJs: pathToFileURL(sqlJsEntry).href,
    },
  };
}

function toReply(line: string | null): RunnerReply {
  return line === null ? { kind: "exit" } : { kind: "line", value: JSON.parse(line) };
}

function lineReader(child: ChildProcess): Pick<Runner, "next"> {
  const lines: string[] = [];
  const waiters: ((line: string | null) => void)[] = [];
  const hasExited = () => child.exitCode !== null || child.signalCode !== null;

  if (child.stdout) {
    createInterface({ input: child.stdout }).on("line", (line) => {
      const waiter = waiters.shift();

      if (waiter) {
        waiter(line);
      } else {
        lines.push(line);
      }
    });
  }

  child.on("exit", () => {
    waiters.splice(0).forEach((waiter) => waiter(null));
  });

  return {
    next: (timeoutMs) => {
      const line = lines.shift();

      if (line !== undefined || hasExited()) {
        return Promise.resolve(toReply(line ?? null));
      }

      return new Promise((resolve) => {
        const waiter = (next: string | null) => {
          clearTimeout(timer);
          resolve(toReply(next));
        };

        const timer = setTimeout(() => {
          waiters.splice(waiters.indexOf(waiter), 1);
          resolve({ kind: "timeout" });
        }, timeoutMs);

        waiters.push(waiter);
      });
    },
  };
}

function startRunner(kinds: readonly ProgramKind[]): Runner {
  const { folders, paths } = resolveRuntimes();

  const child = spawn(
    process.execPath,
    [
      "--permission",
      ...folders.map((folder) => `--allow-fs-read=${join(folder, "*")}`),
      "--disallow-code-generation-from-strings",
      `--max-old-space-size=${RUNNER_HEAP_MB}`,
      "--input-type=module",
      "--eval",
      programRunnerSource({ kinds, paths }),
    ],
    { env: { NODE_ENV: process.env.NODE_ENV }, stdio: ["pipe", "pipe", "pipe"] },
  );

  const errors: string[] = [];
  child.stderr?.on("data", (chunk: Buffer) => errors.push(chunk.toString()));
  child.stdin?.on("error", () => child.kill("SIGKILL"));

  return {
    ...lineReader(child),
    send: (message) => child.stdin?.write(`${JSON.stringify(message)}\n`),
    stderr: () => errors.join("").slice(-STDERR_TAIL_LENGTH),
    stop: () => child.kill("SIGKILL"),
  };
}

type IndexedJob = { id: number; job: ProgramJob };

async function runUntilStopped(runner: Runner, jobs: readonly IndexedJob[]): Promise<ProgramRun[]> {
  const [current, ...rest] = jobs;

  if (!current) {
    return [];
  }

  runner.send({ ...current.job, id: current.id });
  const reply = await runner.next(PROGRAM_TIME_LIMIT_MS[current.job.kind] + RESULT_GRACE_MS);
  const message = reply.kind === "line" ? runnerMessageSchema.parse(reply.value) : null;

  if (message?.type !== "result" || message.id !== current.id) {
    const stopped: RunnerResult = { status: reply.kind === "timeout" ? "timeout" : "crashed" };
    return [toProgramRun(current.job.kind, stopped)];
  }

  return [toProgramRun(current.job.kind, message.result), ...(await runUntilStopped(runner, rest))];
}

async function runBatch(jobs: readonly IndexedJob[]): Promise<ProgramRun[]> {
  if (jobs.length === 0) {
    return [];
  }

  const runner = startRunner([...new Set(jobs.map(({ job }) => job.kind))]);

  try {
    const reply = await runner.next(BOOT_TIMEOUT_MS);

    if (reply.kind !== "line" || runnerMessageSchema.parse(reply.value).type !== "ready") {
      throw new Error(`The program runner didn't start: ${runner.stderr()}`);
    }

    const runs = await runUntilStopped(runner, jobs);
    return [...runs, ...(await runBatch(jobs.slice(runs.length)))];
  } finally {
    runner.stop();
  }
}

/** Returns one result per job in input order; throws if the runner cannot start. */
export async function runPrograms(jobs: readonly ProgramJob[]): Promise<ProgramRun[]> {
  return runBatch(jobs.map((job, id) => ({ id, job })));
}
