import { type ActivityCell } from "../activity-expected-answer";

type ColumnType = "integer" | "real" | "text";

export type SqlTable = {
  columns: readonly { name: string; type: ColumnType }[];
  name: string;
  rows: readonly (readonly ActivityCell[])[];
};

export type SqlStatement = { params: ActivityCell[]; sql: string };

const SQL_TYPES: Record<ColumnType, string> = { integer: "INTEGER", real: "REAL", text: "TEXT" };

/** Identifiers are validated as letters, digits and `_`; quoting keeps words like "order" safe. */
function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * The statements that build the lesson's tables on a fresh database: one CREATE TABLE each, then
 * one parameterized INSERT per row, so cell values are never pasted into SQL. The player's
 * browser sandbox and the server check before publishing build the same database.
 */
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

/** A value SQLite returned as a cell the check compares: text, a number or null. */
export function toSqlCell(value: unknown): ActivityCell {
  if (value === null || typeof value === "number" || typeof value === "string") {
    return value;
  }

  return JSON.stringify(value) ?? "";
}
