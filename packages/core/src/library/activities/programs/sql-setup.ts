import { type ActivityCell } from "../activity-expected-answer";
import { capProgramText } from "./program-limits";

type ColumnType = "integer" | "real" | "text";

export type SqlTable = {
  columns: readonly { name: string; type: ColumnType }[];
  name: string;
  rows: readonly (readonly ActivityCell[])[];
};

export type SqlStatement = { params: ActivityCell[]; sql: string };

/**
 * SQLite's own functions only: sql.js's legacy extensions (a natural-log `log`, `stdev`, `median`…)
 * are deprecated and leave in its next major (https://github.com/sql-js/sql.js/pull/647). The
 * player and the iPhone's worker start sql.js with it too.
 */
export const SQL_JS_CONFIG = { useOldExtensionFunctions: false };

/**
 * `lastTable(db, query)` for every sql.js runner: the last statement that returned a table, with
 * its columns even when no row matched, which sql.js's `db.exec` leaves out.
 */
export const SQL_LAST_TABLE_SOURCE = `function lastTable(db, query) {
  let table = { columns: [], rows: [] };
  for (const statement of db.iterateStatements(query)) {
    const columns = statement.getColumnNames();
    const rows = [];
    while (statement.step()) {
      rows.push(statement.get().map((value) => (value instanceof Uint8Array ? "[blob]" : value)));
    }
    if (columns.length > 0) table = { columns, rows };
  }
  return table;
}`;

const SQL_TYPES: Record<ColumnType, string> = { integer: "INTEGER", real: "REAL", text: "TEXT" };

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function sqlSetupStatements(tables: readonly SqlTable[]): SqlStatement[] {
  return tables.flatMap((table) => {
    const name = quoteIdentifier(table.name);

    const columns = table.columns
      .map((column) => `${quoteIdentifier(column.name)} ${SQL_TYPES[column.type]}`)
      .join(", ");

    const placeholders = table.columns.map(() => "?").join(", ");

    return [
      { params: [], sql: `CREATE TABLE ${name} (${columns});` },
      ...table.rows.map((row) => ({
        params: [...row],
        sql: `INSERT INTO ${name} VALUES (${placeholders});`,
      })),
    ];
  });
}

export function toSqlCell(value: unknown): ActivityCell {
  if (value === null || typeof value === "number") {
    return value;
  }

  return capProgramText(typeof value === "string" ? value : (JSON.stringify(value) ?? ""));
}
