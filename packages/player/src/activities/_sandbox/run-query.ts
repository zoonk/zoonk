import { type ActivityCell } from "@zoonk/core/library/activities/expected-answer";
import {
  type SqlTable,
  sqlSetupStatements,
  toSqlCell,
} from "@zoonk/core/library/activities/sql-setup";
import { runInSandbox } from "./sandbox-host";

export type QueryResult = { columns: string[]; rows: ActivityCell[][] };

export type QueryRun =
  | { result: QueryResult; status: "done" }
  | { message: string; status: "error" }
  | { status: "timeout" | "unavailable" };

/** Runs a query with SQLite in the browser against the lesson's tables. */
export async function runQuery({
  query,
  tables,
}: {
  query: string;
  tables: readonly SqlTable[];
}): Promise<QueryRun> {
  const outcome = await runInSandbox({
    kind: "sql",
    onMessage: () => true,
    payload: { query, setup: sqlSetupStatements(tables) },
  });

  if (outcome.status === "done") {
    const table = outcome.table ?? { columns: [], rows: [] };

    return {
      result: {
        columns: table.columns,
        rows: table.rows.map((row) => row.map((value) => toSqlCell(value))),
      },
      status: "done",
    };
  }

  if (outcome.status === "error") {
    return { message: outcome.message, status: "error" };
  }

  return { status: outcome.status };
}
