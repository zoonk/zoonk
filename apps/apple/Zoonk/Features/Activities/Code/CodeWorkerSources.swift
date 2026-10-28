import Foundation

/// Main's player sandbox (`packages/player/src/activities/_sandbox`), ported: each worker runs
/// learner code in a Web Worker created from a Blob, so a program can't touch the page and a
/// runaway loop is stopped by terminating the worker. Main starts its workers from data URLs so
/// they don't share the signed-in page's origin; this page has no session to share (a
/// non-persistent store) and its CSP blocks the network. Before any learner code runs, each worker
/// removes its network and storage globals. The host page keeps the worker, times each run out
/// and turns its messages into output, like main's `sandbox-host.ts` and `run-program.ts`.
///
/// Pyodide loads from jsDelivr only when a Python activity appears. The version is pinned with
/// main's: update both together.
enum CodeWorkerSources {
  private static let pyodideIndexURL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/"

  /// The page that hosts the language's worker. `warmUp()` loads the runtime; `run(code)`
  /// resolves with how the run ended and what it printed.
  static func page(_ language: CodeLanguage) -> String {
    let runtime = language == .python ? pyodideIndexURL : ""
    let worker = language == .python ? python : javascript

    return """
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: \(runtime); worker-src blob:; connect-src \(runtime.isEmpty ? "'none'" : runtime);">
      <script>
      "use strict";
      const KIND = \(json(language.rawValue));
      const SOURCE = \(json(worker));
      const TIME_LIMIT_MS = \(language.timeLimitSeconds * 1000);
      const MAX_OUTPUT_LENGTH = 10000;
      \(host)
      \(consoleFormat)
      </script>
      """
  }

  private static func json(_ text: String) -> String {
    String(decoding: try! JSONEncoder().encode(text), as: UTF8.self)
  }

  private static let host = #"""
    let host = null;
    let nextId = 1;

    function createHost() {
      const url = URL.createObjectURL(new Blob([SOURCE], { type: "text/javascript" }));
      const worker = new Worker(url, { type: KIND === "python" ? "module" : "classic" });
      const ready = new Promise((resolve) => {
        function handleMessage(event) {
          if (event.data.type !== "ready" && event.data.type !== "loadError") return;
          worker.removeEventListener("message", handleMessage);
          URL.revokeObjectURL(url);
          resolve(event.data.type === "ready");
        }
        worker.addEventListener("message", handleMessage);
        worker.addEventListener("error", () => resolve(false), { once: true });
      });
      return { ready, worker };
    }

    function discardHost(current) {
      current.worker.terminate();
      if (host === current) host = null;
    }

    async function warmUp() {
      host = host ?? createHost();
      const current = host;
      const isReady = await current.ready;
      if (!isReady) discardHost(current);
      return isReady;
    }

    /** The error on a traceback's last line and the line of main.py it points to. */
    function pythonError(traceback) {
      const lines = traceback.trimEnd().split("\n");
      const programLine = [...traceback.matchAll(/File "main\.py", line (\d+)/g)].at(-1)?.[1];
      return { line: programLine ? Number(programLine) : null, message: lines.at(-1)?.trim() ?? traceback };
    }

    /** One run in the warm worker. Output is kept when the program fails or runs out of time. */
    async function run(code) {
      if (!(await warmUp())) return { stop: "unavailable" };
      const current = host;
      const id = nextId++;
      const streams = { stderr: "", stdout: "" };

      return new Promise((resolve) => {
        function finish(outcome, keepWorker) {
          clearTimeout(timer);
          current.worker.removeEventListener("message", handleMessage);
          if (!keepWorker || KIND === "javascript") discardHost(current);
          resolve({ errorOutput: streams.stderr, output: streams.stdout.slice(0, MAX_OUTPUT_LENGTH), ...outcome });
        }

        function handleMessage({ data }) {
          if (data.id !== id) return;
          if (data.type === "done") return finish({ stop: "done" }, true);
          if (data.type === "error") {
            const error = KIND === "python" ? pythonError(data.message) : { line: data.line ?? null, message: data.message };
            return finish({ stop: "error", ...error }, true);
          }
          streams[data.stream] += data.type === "log" ? formatConsoleArgs(data.args) + "\n" : data.text;
          if (streams.stdout.length + streams.stderr.length > MAX_OUTPUT_LENGTH) finish({ stop: "tooMuchOutput" }, false);
        }

        const timer = setTimeout(() => finish({ stop: "timeout" }, false), TIME_LIMIT_MS);
        current.worker.addEventListener("message", handleMessage);
        current.worker.postMessage({ code, id });
      });
    }
    """#

  /// Core's `formatConsoleArgs`: a `console.log` call as Node prints it on one line.
  private static let consoleFormat = #"""
    const IDENTIFIER = /^[$A-Z_a-z][\w$]*$/u;

    function quote(text) {
      return text.includes("'") && !text.includes('"') ? `"${text}"` : `'${text.replaceAll("'", "\\'")}'`;
    }

    function list(open, items, close) {
      return items.length === 0 ? `${open}${close}` : `${open} ${items.join(", ")} ${close}`;
    }

    function formatTagged(value) {
      switch (value.$zoonk) {
        case "circular": return "[Circular]";
        case "deepArray": return "[Array]";
        case "deepObject": return "[Object]";
        case "function": return value.name ? `[Function: ${value.name}]` : "[Function (anonymous)]";
        case "map": return `Map(${value.entries.length}) ${list("{", value.entries.map(([key, item]) => `${formatNested(key)} => ${formatNested(item)}`), "}")}`;
        case "object": {
          const body = list("{", value.entries.map(([key, item]) => `${IDENTIFIER.test(key) ? key : quote(key)}: ${formatNested(item)}`), "}");
          return value.name ? `${value.name} ${body}` : body;
        }
        case "set": return `Set(${value.values.length}) ${list("{", value.values.map((item) => formatNested(item)), "}")}`;
        case "text": return value.text;
        case "undefined": return "undefined";
        default: return "";
      }
    }

    function formatNested(value) {
      return typeof value === "string" ? quote(value) : formatConsoleValue(value);
    }

    function formatConsoleValue(value) {
      if (Array.isArray(value)) return list("[", value.map((item) => formatNested(item)), "]");
      if (typeof value === "object" && value !== null && "$zoonk" in value) return formatTagged(value);
      if (Object.is(value, -0)) return "-0";
      return String(value);
    }

    function formatConsoleArgs(args) {
      return args.map((arg) => formatConsoleValue(arg)).join(" ");
    }
    """#

  private static let lockDown = #"""
    function lockDown() {
      for (const name of ["BroadcastChannel","EventSource","SharedWorker","WebSocket","WebSocketStream","WebTransport","Worker","XMLHttpRequest","caches","fetch","importScripts","indexedDB"]) {
        for (let target = self; target; target = Object.getPrototypeOf(target)) {
          if (Object.prototype.hasOwnProperty.call(target, name)) {
            try {
              Object.defineProperty(target, name, { configurable: false, value: undefined, writable: false });
            } catch {}
          }
        }
      }
    }
    """#

  /// One program per worker, so nothing a run leaves behind leaks into the next. `console`
  /// output is sent as structured-cloneable values and formatted on the page. The run ends when
  /// the program and every timer it started have finished.
  private static let javascript = #"""
    "use strict";
    \#(lockDown)
    const post = self.postMessage.bind(self);
    const nativeSetTimeout = self.setTimeout.bind(self);
    const nativeClearTimeout = self.clearTimeout.bind(self);
    const nativeSetInterval = self.setInterval.bind(self);
    const nativeClearInterval = self.clearInterval.bind(self);
    const AsyncFunction = (async () => {}).constructor;
    const state = { finished: false, id: null, mainDone: false, pending: new Set() };
    const MAX_DEPTH = 4;

    function toCloneable(value, depth, path) {
      if (typeof value === "function") return { $zoonk: "function", name: value.name };
      if (typeof value === "symbol") return { $zoonk: "text", text: value.toString() };
      if (typeof value === "bigint") return { $zoonk: "text", text: value.toString() + "n" };
      if (value === undefined) return { $zoonk: "undefined" };
      if (value === null || typeof value !== "object") return value;
      if (path.includes(value)) return { $zoonk: "circular" };
      if (depth > MAX_DEPTH) return { $zoonk: Array.isArray(value) ? "deepArray" : "deepObject" };
      const next = [...path, value];
      const inner = (item) => toCloneable(item, depth + 1, next);
      if (Array.isArray(value)) return value.map(inner);
      if (value instanceof Error) return { $zoonk: "text", text: value.name + ": " + value.message };
      if (value instanceof Date) return { $zoonk: "text", text: value.toISOString() };
      if (value instanceof Map) return { $zoonk: "map", entries: [...value].map(([key, item]) => [inner(key), inner(item)]) };
      if (value instanceof Set) return { $zoonk: "set", values: [...value].map(inner) };
      const constructor = Object.getPrototypeOf(value)?.constructor;
      const name = constructor && constructor !== Object ? constructor.name : "";
      return { $zoonk: "object", entries: Object.keys(value).map((key) => [key, inner(value[key])]), name };
    }

    function send(stream, args) {
      if (!state.finished) {
        post({ args: args.map((arg) => toCloneable(arg, 0, [])), id: state.id, stream, type: "log" });
      }
    }

    // WebKit keeps the line on the error; the function wrapper adds two lines before the program.
    function lineOf(error) {
      const line = Number(error && error.line) - 2;
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
    """#

  /// Python through Pyodide, in a module worker. Booting takes a few seconds, so one worker is
  /// kept and every run gets fresh globals. The `js` module sees an empty object instead of the
  /// worker's globals.
  private static let python = #"""
    \#(lockDown)
    const INDEX_URL = \#(json(pyodideIndexURL));
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
        pyodide.runPython("import sys\nsys.stdout.flush()\nsys.stderr.flush()");
        post({ id, type: "done" });
      } catch (error) {
        pyodide.runPython("import sys\nsys.stdout.flush()\nsys.stderr.flush()");
        post({ id, message: String((error && error.message) || error), type: "error" });
      } finally {
        globals.destroy();
      }
    };
    """#
}
