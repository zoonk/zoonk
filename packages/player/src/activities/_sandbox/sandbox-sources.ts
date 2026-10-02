import { CONSOLE_VALUE_SOURCE } from "@zoonk/core/library/activities/console-values";

/**
 * Worker sources for running learner code in the browser, never on our servers. Each runs in its
 * own Web Worker, created from a Blob, so a program can't touch the page and a runaway loop is
 * stopped by terminating the worker. Before any learner code runs, each worker removes its
 * network and storage globals, so lesson code can't reach the network or the learner's session.
 *
 * Pyodide and sql.js load from jsDelivr only when a template that needs them appears, so the
 * player's own bundle doesn't grow. Versions are pinned: update both the URL and the note in
 * `README.md` together.
 */
const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
const SQL_JS_BASE_URL = "https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/";

const LOCKED_GLOBALS = [
  "BroadcastChannel",
  "EventSource",
  "SharedWorker",
  "WebSocket",
  "WebSocketStream",
  "WebTransport",
  "Worker",
  "XMLHttpRequest",
  "caches",
  "fetch",
  "importScripts",
  "indexedDB",
];

/** Shared by every worker: hide network and storage globals on the scope and its prototypes. */
const LOCK_DOWN = `
function lockDown() {
  for (const name of ${JSON.stringify(LOCKED_GLOBALS)}) {
    for (let target = self; target; target = Object.getPrototypeOf(target)) {
      if (Object.prototype.hasOwnProperty.call(target, name)) {
        try {
          Object.defineProperty(target, name, { configurable: false, value: undefined, writable: false });
        } catch {}
      }
    }
  }
}
`;

/**
 * JavaScript: one program per worker, so nothing a run leaves behind (globals, timers) leaks
 * into the next. `console` output is sent as structured-cloneable values and formatted on the
 * page. The run ends when the program and every timer it started have finished.
 */
export const JAVASCRIPT_WORKER_SOURCE = `"use strict";
${LOCK_DOWN}
const post = self.postMessage.bind(self);
const nativeSetTimeout = self.setTimeout.bind(self);
const nativeClearTimeout = self.clearTimeout.bind(self);
const nativeSetInterval = self.setInterval.bind(self);
const nativeClearInterval = self.clearInterval.bind(self);
const AsyncFunction = (async () => {}).constructor;
const state = { failed: false, finished: false, id: null, mainDone: false, pending: new Set() };
${CONSOLE_VALUE_SOURCE}
function send(stream, args) {
  if (!state.finished) {
    post({ args: args.map((arg) => toCloneable(arg, 0, [])), id: state.id, stream, type: "log" });
  }
}

function lineOf(error) {
  const match = /(?:<anonymous>|Function):(\\d+):\\d+/.exec(String(error && error.stack));
  const line = match ? Number(match[1]) - 2 : 0;
  return line > 0 ? line : null;
}

function fail(error) {
  if (state.finished) return;
  state.finished = true;
  const message = error instanceof Error ? error.name + ": " + error.message : "Uncaught " + String(error);
  post({ id: state.id, line: lineOf(error), message, type: "error" });
}

function maybeFinish() {
  if (state.mainDone && !state.finished && state.pending.size === 0) {
    state.finished = true;
    post({ id: state.id, type: "done" });
  }
}

function guarded(callback, args) {
  try {
    if (typeof callback === "function") callback(...args);
  } catch (error) {
    fail(error);
  }
}

console.log = console.info = console.debug = console.table = (...args) => send("stdout", args);
console.error = console.warn = (...args) => send("stderr", args);

self.setTimeout = (callback, delay, ...args) => {
  const handle = nativeSetTimeout(() => {
    state.pending.delete(handle);
    guarded(callback, args);
    maybeFinish();
  }, delay);
  state.pending.add(handle);
  return handle;
};

self.clearTimeout = (handle) => {
  state.pending.delete(handle);
  nativeClearTimeout(handle);
  nativeSetTimeout(maybeFinish, 0);
};

self.setInterval = (callback, delay, ...args) => {
  const handle = nativeSetInterval(() => guarded(callback, args), delay);
  state.pending.add(handle);
  return handle;
};

self.clearInterval = (handle) => {
  state.pending.delete(handle);
  nativeClearInterval(handle);
  nativeSetTimeout(maybeFinish, 0);
};

self.addEventListener("unhandledrejection", (event) => fail(event.reason));
lockDown();

self.onmessage = (event) => {
  state.id = event.data.id;
  let main;
  try {
    main = new AsyncFunction(event.data.code);
  } catch (error) {
    fail(error);
    return;
  }
  Promise.resolve()
    .then(() => main())
    .then(() => nativeSetTimeout(() => { state.mainDone = true; maybeFinish(); }, 0), fail);
};

post({ type: "ready" });
`;

/**
 * Python through Pyodide, in a module worker (Pyodide ships as an ES module). Booting takes a
 * few seconds, so one worker is kept for the page and every run gets fresh globals. The \`js\`
 * module sees an empty object instead of the worker's globals.
 */
export const PYTHON_WORKER_SOURCE = `
${LOCK_DOWN}
const INDEX_URL = ${JSON.stringify(PYODIDE_INDEX_URL)};
const post = (message) => self.postMessage(message);
const state = { decoders: {}, id: null };

function writer(stream) {
  return {
    write(buffer) {
      const decoder = state.decoders[stream];
      post({ id: state.id, stream, text: decoder.decode(buffer, { stream: true }), type: "output" });
      return buffer.length;
    },
  };
}

const ready = import(INDEX_URL + "pyodide.mjs")
  .then(({ loadPyodide }) => loadPyodide({ indexURL: INDEX_URL, jsglobals: {} }))
  .then((pyodide) => {
    pyodide.setStdout(writer("stdout"));
    pyodide.setStderr(writer("stderr"));
    pyodide.setStdin({ stdin: () => null });
    lockDown();
    post({ type: "ready" });
    return pyodide;
  })
  .catch((error) => {
    post({ message: String(error), type: "loadError" });
    return null;
  });

self.onmessage = async (event) => {
  const pyodide = await ready;
  if (!pyodide) return;
  const { code, id } = event.data;
  state.id = id;
  state.decoders = { stderr: new TextDecoder(), stdout: new TextDecoder() };
  const globals = pyodide.globals.get("dict")();
  globals.set("__name__", "__main__");
  try {
    await pyodide.runPythonAsync(code, { dedent: false, filename: "main.py", globals });
    pyodide.runPython("import sys\\nsys.stdout.flush()\\nsys.stderr.flush()");
    post({ id, type: "done" });
  } catch (error) {
    pyodide.runPython("import sys\\nsys.stdout.flush()\\nsys.stderr.flush()");
    post({ id, message: String((error && error.message) || error), type: "error" });
  } finally {
    globals.destroy();
  }
};
`;

/**
 * SQLite through sql.js. Each query runs on a fresh in-memory database built from the lesson's
 * tables, so a DELETE or DROP never carries over, and the result of the last statement is sent.
 */
export const SQL_WORKER_SOURCE = `"use strict";
${LOCK_DOWN}
const BASE_URL = ${JSON.stringify(SQL_JS_BASE_URL)};
importScripts(BASE_URL + "sql-wasm.js");
const post = self.postMessage.bind(self);

function cell(value) {
  return value instanceof Uint8Array ? "[blob]" : value;
}

const ready = initSqlJs({ locateFile: (file) => BASE_URL + file }).then(
  (SQL) => {
    lockDown();
    post({ type: "ready" });
    return SQL;
  },
  (error) => {
    post({ message: String(error), type: "loadError" });
    return null;
  },
);

self.onmessage = async (event) => {
  const SQL = await ready;
  if (!SQL) return;
  const { id, query, setup } = event.data;
  const db = new SQL.Database();
  try {
    for (const statement of setup) db.run(statement.sql, statement.params);
    const results = db.exec(query);
    const last = results[results.length - 1];
    const table = last
      ? { columns: last.columns, rows: last.values.map((row) => row.map(cell)) }
      : { columns: [], rows: [] };
    post({ id, table, type: "done" });
  } catch (error) {
    post({ id, message: String((error && error.message) || error), type: "error" });
  } finally {
    db.close();
  }
};
`;
