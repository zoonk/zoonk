import { describe, expect, it } from "vitest";
import { runQuery } from "../activities/_sandbox/run-query";

describe(runQuery, () => {
  it("runs SQLite's own functions, as the server's check and the iPhone app do", async () => {
    const [math, notSqlite] = await Promise.all([
      runQuery({
        query: "SELECT log(100) AS log, ln(1) AS ln, mod(7, 3) AS mod, sqrt(16) AS root;",
        tables: [],
      }),
      runQuery({ query: "SELECT stdev(1);", tables: [] }),
    ]);

    expect(math).toStrictEqual({
      result: { columns: ["log", "ln", "mod", "root"], rows: [[2, 0, 1, 4]] },
      status: "done",
    });

    expect(notSqlite).toStrictEqual({ message: "no such function: stdev", status: "error" });
  });
});
