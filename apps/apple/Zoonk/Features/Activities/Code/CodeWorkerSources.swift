import Foundation

// Worker behavior and console formatting mirror packages/player activities/_sandbox.
enum CodeWorkerSources {
  static let javascript = #"""
    "use strict";

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

    const post = self.postMessage.bind(self);
    /**
     * How a JavaScript program's `console.log` output becomes text, shared by the player's browser
     * sandbox and the server check before publishing, so both print a program the same way and a
     * lesson's expected output means the same thing in both places.
     *
     * Inside a sandbox, `toCloneable` turns each argument into plain data: primitives and arrays as
     * they are, everything else tagged, because functions and class instances can't leave the
     * sandbox. Outside it, `formatConsoleArgs` prints that data like Node does on one line.
     */
    const CONSOLE_VALUE_SOURCE = `
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
    `;

    /** Values `toCloneable` produces for what isn't a primitive or an array. */








    const IDENTIFIER = /^[$A-Z_a-z][\w$]*$/u;

    function isTagged(value         )                       {
      return typeof value === "object" && value !== null && "$zoonk" in value;
    }

    /** Strings inside collections are quoted like Node: single quotes unless the text has one. */
    function quote(text        )         {
      return text.includes("'") && !text.includes('"')
        ? `"${text}"`
        : `'${text.replaceAll("'", String.raw`\'`)}'`;
    }

    function list(open        , items                   , close        )         {
      return items.length === 0 ? `${open}${close}` : `${open} ${items.join(", ")} ${close}`;
    }

    function formatTagged(value             )         {
      switch (value.$zoonk) {
        case "circular":
          return "[Circular]";
        case "deepArray":
          return "[Array]";
        case "deepObject":
          return "[Object]";
        case "function":
          return value.name ? `[Function: ${value.name}]` : "[Function (anonymous)]";
        case "map":
          return `Map(${value.entries.length}) ${list(
            "{",
            value.entries.map(([key, item]) => `${formatNested(key)} => ${formatNested(item)}`),
            "}",
          )}`;
        case "object": {
          const body = list(
            "{",
            value.entries.map(
              ([key, item]) => `${IDENTIFIER.test(key) ? key : quote(key)}: ${formatNested(item)}`,
            ),
            "}",
          );

          return value.name ? `${value.name} ${body}` : body;
        }
        case "set":
          return `Set(${value.values.length}) ${list(
            "{",
            value.values.map((item) => formatNested(item)),
            "}",
          )}`;
        case "text":
          return value.text;
        case "undefined":
          return "undefined";
        default:
          return "";
      }
    }

    function formatNested(value         )         {
      return typeof value === "string" ? quote(value) : formatConsoleValue(value);
    }

    /** One value as `console.log` prints it on its own: strings as they are, the rest like Node. */
    function formatConsoleValue(value         )         {
      if (Array.isArray(value)) {
        return list(
          "[",
          value.map((item) => formatNested(item)),
          "]",
        );
      }

      if (isTagged(value)) {
        return formatTagged(value);
      }

      if (Object.is(value, -0)) {
        return "-0";
      }

      return String(value);
    }

    /**
     * One `console.log` call as a line of text, the way Node prints it on one line: strings as they
     * are, arrays like `[ 1, 2 ]`, objects like `{ a: 1, b: 'x' }`. The writer is told to expect this.
     */
    function formatConsoleArgs(args                    )         {
      return args.map((arg) => formatConsoleValue(arg)).join(" ");
    }

    const nativeSetTimeout = self.setTimeout.bind(self);
    const nativeClearTimeout = self.clearTimeout.bind(self);
    const nativeSetInterval = self.setInterval.bind(self);
    const nativeClearInterval = self.clearInterval.bind(self);
    const AsyncFunction = (async () => {}).constructor;
    const state = { failed: false, finished: false, id: null, mainDone: false, pending: new Set() };

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
        post({ text: formatConsoleArgs(args.map((arg) => toCloneable(arg, 0, []))) + "\n", id: state.id, stream, type: "output" });
      }
    }

    function lineOf(error) {
      const match = /(?:<anonymous>|Function):(\d+):\d+/.exec(String(error && error.stack));
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

    """#
  static let python = #"""


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

    const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
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
