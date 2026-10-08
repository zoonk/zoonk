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

/** A program to run: JavaScript or Python (traced when `watch` is set), or a SQL query. */
export type ProgramJob =
  | { kind: "javascript"; code: string }
  | { kind: "python"; code: string; watch?: readonly string[] }
  | { kind: "sql"; query: string; setup: readonly SqlStatement[] };

/** Pyodide takes a couple of seconds to load; more than this means the runner is broken. */
const BOOT_TIMEOUT_MS = 30_000;
/** Time for a result to arrive after the run's own limit, before the runner is stopped. */
const RESULT_GRACE_MS = 1000;
/** The runner's own JavaScript heap; WebAssembly memory is limited by each runtime. */
const RUNNER_HEAP_MB = 256;
/** Enough of the runner's stderr to say why it didn't start. */
const STDERR_TAIL_LENGTH = 2000;

/** What the runner said next: a line of JSON, nothing in time, or nothing because it exited. */
type RunnerReply = { kind: "exit" } | { kind: "line"; value: unknown } | { kind: "timeout" };

type Runner = {
  next: (timeoutMs: number) => Promise<RunnerReply>;
  send: (message: object) => void;
  stderr: () => string;
  stop: () => void;
};

/**
 * The runtimes' files, resolved from this package, and the folders the runner may read. The
 * runner needs paths on disk, and bundlers turn `require.resolve` from `node:module` imports into
 * module ids, so `require` comes from Node's built-in loader at run time.
 */
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

/** Reads the runner's stdout one JSON line at a time. */
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

/**
 * Starts a runner process for the kinds a batch needs. Model-written code never runs in the
 * server's own process: the runner gets no environment variables besides `NODE_ENV` (which the
 * apps' environment types require), can only read the runtimes' files, can't start processes or
 * workers, can't turn strings into code, and runs each program inside a WebAssembly runtime.
 */
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

/**
 * Runs jobs one after another until one runs out of time or the runner dies. Returns the results
 * so far, the stopped job included, so the caller can start a fresh runner for the rest.
 */
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

/**
 * Runs lesson programs the way the player runs them in the browser, with the same time and
 * output limits, and returns one result per job in order. Runtimes load only for the kinds the
 * jobs use, so Pyodide loads only when there is Python. A runner that can't start throws.
 */
export async function runPrograms(jobs: readonly ProgramJob[]): Promise<ProgramRun[]> {
  return runBatch(jobs.map((job, id) => ({ id, job })));
}
