import { describe, expect, it } from "vitest";
import { runPrograms } from "./run-programs";
import { sqlSetupStatements } from "./sql-setup";

/** Pyodide loads in a couple of seconds; an endless loop waits out its 5 second limit. */
const PYTHON_TEST_TIMEOUT_MS = 30_000;

const countries = sqlSetupStatements([
  {
    columns: [
      { name: "name", type: "text" },
      { name: "pop", type: "integer" },
    ],
    name: "countries",
    rows: [
      ["India", 1451],
      ["Brazil", 212],
    ],
  },
]);

describe(runPrograms, () => {
  it("prints JavaScript like the player: Node-style values, one line per call, timers after the program", async () => {
    const [run] = await runPrograms([
      {
        code: [
          'setTimeout(() => console.log("later"), 10);',
          'console.log([1, 2], { a: 1, "b-c": "x" }, "plain");',
          "console.log(0.1 + 0.2, -0, new Map([[1, true]]));",
          "await null;",
          'console.log("after await");',
        ].join("\n"),
        kind: "javascript",
      },
    ]);

    expect(run).toMatchObject({ error: null, status: "done" });

    expect(run?.output).toBe(
      "[ 1, 2 ] { a: 1, 'b-c': 'x' } plain\n0.30000000000000004 -0 Map(1) { 1 => true }\nafter await\nlater\n",
    );
  });

  it("reports JavaScript errors with their line, endless loops and floods", async () => {
    const [failing, endless, flood] = await runPrograms([
      { code: "const list = [1];\nconsole.log(list.missing.length);", kind: "javascript" },
      { code: "let n = 0;\nwhile (true) { n += 1; }", kind: "javascript" },
      { code: 'while (true) console.log("x".repeat(100));', kind: "javascript" },
    ]);

    expect(failing).toMatchObject({ error: { line: 2 }, status: "error" });
    expect(failing?.error?.message).toContain("TypeError");
    expect(endless?.status).toBe("timeout");
    expect(flood?.status).toBe("tooMuchOutput");
  });

  it("gives JavaScript no way out of its sandbox", async () => {
    const [run] = await runPrograms([
      {
        code: "console.log([typeof require, typeof process, typeof fetch, typeof WebSocket].join(' '));",
        kind: "javascript",
      },
    ]);

    expect(run?.output).toBe("undefined undefined undefined undefined\n");
  });

  it("runs SQL on a fresh database and stops a query that never ends", async () => {
    const [query, failing, endless, after] = await runPrograms([
      {
        kind: "sql",
        query: "SELECT name, pop FROM countries ORDER BY pop DESC;",
        setup: countries,
      },
      { kind: "sql", query: "SELECT nope FROM countries;", setup: countries },
      {
        kind: "sql",
        query:
          "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT count(*) FROM n;",
        setup: countries,
      },
      { kind: "sql", query: "SELECT count(*) AS total FROM countries;", setup: countries },
    ]);

    expect(query).toMatchObject({
      status: "done",
      table: {
        columns: ["name", "pop"],
        rows: [
          ["India", 1451],
          ["Brazil", 212],
        ],
      },
    });

    expect(failing).toMatchObject({ error: { message: "no such column: nope" }, status: "error" });
    expect(endless?.status).toBe("timeout");
    expect(after).toMatchObject({ status: "done", table: { rows: [[2]] } });
  });

  it(
    "runs Python like the player, with errors on their line and no network, host files or JavaScript",
    async () => {
      const [sum, failing, sandboxed, endless] = await runPrograms([
        {
          code: "total = 0\nfor n in range(1, 101):\n    total += n\nprint(total)",
          kind: "python",
        },
        { code: "names = ['Ana']\nprint(names[3])", kind: "python" },
        {
          code: [
            "import socket",
            "def attempt(action):",
            "    try:",
            "        action()",
            "        return 'reached'",
            "    except Exception as error:",
            "        return type(error).__name__",
            "print(attempt(lambda: socket.create_connection(('example.com', 80), timeout=1)))",
            "print(attempt(lambda: open('/etc/hosts').read()))",
            "print(attempt(lambda: __import__('js')))",
            "print(attempt(lambda: __import__('pyodide_js')))",
          ].join("\n"),
          kind: "python",
        },
        { code: "while True:\n    pass", kind: "python" },
      ]);

      expect(sum).toMatchObject({ error: null, output: "5050\n", status: "done" });

      expect(failing).toMatchObject({
        error: { line: 2, message: "IndexError: list index out of range" },
        status: "error",
      });

      expect(sandboxed?.output).toBe("OSError\nFileNotFoundError\nImportError\nImportError\n");
      expect(endless?.status).toBe("timeout");
    },
    PYTHON_TEST_TIMEOUT_MS,
  );

  it(
    "traces a Python run: each line once it has run, with the watched values",
    async () => {
      const [run] = await runPrograms([
        {
          code: "total = 0\nfor n in [2, 3]:\n    total += n\nlabel = 'done'",
          kind: "python",
          watch: ["total", "n", "label"],
        },
      ]);

      expect(run?.status).toBe("done");

      expect(run?.steps).toStrictEqual([
        { line: 1, values: [{ kind: "number", value: 0 }, null, null] },
        { line: 2, values: [{ kind: "number", value: 0 }, { kind: "number", value: 2 }, null] },
        { line: 3, values: [{ kind: "number", value: 2 }, { kind: "number", value: 2 }, null] },
        { line: 2, values: [{ kind: "number", value: 2 }, { kind: "number", value: 3 }, null] },
        { line: 3, values: [{ kind: "number", value: 5 }, { kind: "number", value: 3 }, null] },
        { line: 2, values: [{ kind: "number", value: 5 }, { kind: "number", value: 3 }, null] },
        {
          line: 4,
          values: [
            { kind: "number", value: 5 },
            { kind: "number", value: 3 },
            { kind: "string", value: "done" },
          ],
        },
      ]);
    },
    PYTHON_TEST_TIMEOUT_MS,
  );
});
