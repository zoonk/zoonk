import { JAVASCRIPT_PRELUDE } from "./javascript-prelude";
import { MAX_TRACE_STEPS, PROGRAM_TIME_LIMIT_MS, type ProgramKind } from "./program-limits";
import { PYTHON_HARNESS } from "./python-harness";

/** Where the runner loads each runtime from, as file URLs and paths it's allowed to read. */
export type RunnerPaths = { pyodide: string; quickjs: string; quickjsWasm: string; sqlJs: string };

/** More than any lesson's program logs; a flood stops the run. */
const MAX_LOG_LENGTH = 50_000;
/** QuickJS's heap for one run: 64 MiB, far more than a lesson program allocates. */
const JAVASCRIPT_MEMORY_BYTES = 67_108_864;

/** The runner's code after its settings: load, lock down, then answer one job per line. */
const RUNNER_BODY = `const write = process.stdout.write.bind(process.stdout);
const input = createInterface({ crlfDelay: Infinity, input: process.stdin });
const send = (message) => write(JSON.stringify(message) + "\\n");
const runtimes = {};

// Pyodide reads file flags this way; the permission model blocks process.binding itself.
process.binding = (name) => {
  if (name === "constants") return { fs: constants };
  throw new Error("Not available");
};

function lockDown() {
  globalThis.require = () => {
    throw new Error("Not available");
  };
  for (const name of ["BroadcastChannel", "EventSource", "WebSocket", "XMLHttpRequest", "fetch", "process"]) {
    try {
      delete globalThis[name];
    } catch {}
  }
}

async function load() {
  if (KINDS.includes("javascript")) {
    const { QuickJS } = await import(PATHS.quickjs);
    runtimes.javascript = { QuickJS, wasm: await WebAssembly.compile(readFileSync(PATHS.quickjsWasm)) };
  }
  if (KINDS.includes("sql")) {
    const initSqlJs = (await import(PATHS.sqlJs)).default;
    runtimes.sql = await initSqlJs();
  }
  if (KINDS.includes("python")) {
    const { loadPyodide } = await import(PATHS.pyodide);
    const pyodide = await loadPyodide({ jsglobals: {} });
    pyodide.setStdin({ stdin: () => null });
    const harness = pyodide.globals.get("dict")();
    pyodide.runPython(HARNESS, { globals: harness });
    runtimes.python = { harness, pyodide };
  }
}

function receive(state, kind, payload) {
  if (kind === "log") {
    state.logLength += payload.length;
    state.logs.push(JSON.parse(payload));
    if (state.logLength > MAX_LOG_LENGTH) state.stop = "tooMuchOutput";
  } else if (kind === "step") {
    state.steps.push(JSON.parse(payload));
    if (state.steps.length > MAX_TRACE_STEPS) state.stop = "tooManySteps";
  } else if (kind === "error") {
    state.error = state.error ?? JSON.parse(payload);
  } else if (kind === "done") {
    state.settled = true;
  }
}

function drain(vm, state) {
  for (;;) {
    vm.executePendingJobs();
    if (state.stop || state.error) return;
    const ran = vm.evalCode("__zoonkNextTimer()", "prelude.js");
    const hasTimer = ran.toBoolean();
    ran.dispose();
    if (!hasTimer) {
      if (!state.settled) state.stop = "timeout";
      return;
    }
  }
}

function exceptionOf(error) {
  const match = /main\\.js:(\\d+)/.exec(String(error && error.stack));
  const name = error && error.name && error.name !== "JSException" ? error.name + ": " : "";
  return { line: match ? Number(match[1]) : null, message: name + String((error && error.message) || error) };
}

async function runJavaScript({ code }) {
  const { QuickJS, wasm } = runtimes.javascript;
  const state = { error: null, logLength: 0, logs: [], settled: false, steps: [], stop: null };
  const deadline = Date.now() + LIMITS.javascript;
  const interruptHandler = () => {
    if (!state.stop && Date.now() > deadline) state.stop = "timeout";
    return state.stop !== null;
  };
  const vm = await QuickJS.create({ interruptHandler, memoryLimit: MEMORY_BYTES, wasm });
  try {
    const emit = vm.newFunction("__zoonkEmit", (kind, payload) => {
      receive(state, kind.toString(), payload.toString());
      return vm.getUndefined();
    });
    vm.setProp(vm.global, "__zoonkEmit", emit);
    emit.dispose();
    vm.evalCode(PRELUDE, "prelude.js").dispose();
    vm.evalCode("(async () => {" + code + "\\n})().then(() => __zoonkEmit(\\"done\\", \\"\\"), __zoonkFail);", "main.js").dispose();
    drain(vm, state);
  } catch (error) {
    if (!state.stop && !state.error) state.error = exceptionOf(error);
  } finally {
    vm.dispose();
  }
  return { error: state.error, logs: state.logs, status: state.stop ?? (state.error ? "error" : "done"), steps: state.steps };
}

async function runPython({ code, watch }) {
  const { harness, pyodide } = runtimes.python;
  const output = { stderr: "", stdout: "" };
  const flags = { flooded: false };
  const writer = (stream) => {
    const decoder = new TextDecoder();
    return {
      write(buffer) {
        output[stream] += decoder.decode(buffer, { stream: true });
        if (output.stdout.length + output.stderr.length > MAX_LOG_LENGTH) {
          flags.flooded = true;
          throw new Error("Too much output");
        }
        return buffer.length;
      },
    };
  };
  pyodide.setStdout(writer("stdout"));
  pyodide.setStderr(writer("stderr"));
  const globals = pyodide.globals.get("dict")();
  globals.set("__name__", "__main__");
  if (watch) harness.get("start")(watch, MAX_TRACE_STEPS);
  const result = await pyodide
    .runPythonAsync(code, { dedent: false, filename: "main.py", globals })
    .then(() => ({ error: null }), (error) => ({ error: String((error && error.message) || error) }));
  const steps = watch ? JSON.parse(harness.get("stop")()) : [];
  try {
    pyodide.runPython("import sys\\nsys.stdout.flush()\\nsys.stderr.flush()");
  } catch {}
  globals.destroy();
  const tooManySteps = steps.length > MAX_TRACE_STEPS;
  const status = flags.flooded ? "tooMuchOutput" : tooManySteps ? "tooManySteps" : result.error ? "error" : "done";
  return { error: result.error, status, stderr: output.stderr, stdout: output.stdout, steps };
}

function runSql({ query, setup }) {
  const db = new runtimes.sql.Database();
  try {
    for (const statement of setup) db.run(statement.sql, statement.params);
    const results = db.exec(query);
    const last = results[results.length - 1];
    const cell = (value) => (value instanceof Uint8Array ? "[blob]" : value);
    const table = last ? { columns: last.columns, rows: last.values.map((row) => row.map(cell)) } : { columns: [], rows: [] };
    return { status: "done", table };
  } catch (error) {
    return { error: String((error && error.message) || error), status: "error" };
  } finally {
    db.close();
  }
}

const RUNNERS = { javascript: runJavaScript, python: runPython, sql: runSql };

await load();
lockDown();
send({ type: "ready" });

for await (const line of input) {
  const job = JSON.parse(line);
  send({ id: job.id, result: await RUNNERS[job.kind](job), type: "result" });
}
`;

/**
 * The runner process: loads the runtimes a batch needs, removes what could reach the network or
 * the host from its globals, then runs one job per stdin line and answers with one JSON line.
 * JavaScript runs in QuickJS, Python in Pyodide and SQL in sql.js, all WebAssembly; the process
 * itself starts with no environment, read access only to the runtimes' own files and no child
 * processes, and the server stops it when a run goes over its time limit.
 */
export function programRunnerSource({
  kinds,
  paths,
}: {
  kinds: readonly ProgramKind[];
  paths: RunnerPaths;
}): string {
  const settings = [
    'import { constants, readFileSync } from "node:fs";',
    'import { createInterface } from "node:readline";',
    `const PATHS = ${JSON.stringify(paths)};`,
    `const KINDS = ${JSON.stringify(kinds)};`,
    `const LIMITS = ${JSON.stringify(PROGRAM_TIME_LIMIT_MS)};`,
    `const PRELUDE = ${JSON.stringify(JAVASCRIPT_PRELUDE)};`,
    `const HARNESS = ${JSON.stringify(PYTHON_HARNESS)};`,
    `const MAX_LOG_LENGTH = ${MAX_LOG_LENGTH};`,
    `const MAX_TRACE_STEPS = ${MAX_TRACE_STEPS};`,
    `const MEMORY_BYTES = ${JAVASCRIPT_MEMORY_BYTES};`,
  ];

  return `${settings.join("\n")}\n${RUNNER_BODY}`;
}
