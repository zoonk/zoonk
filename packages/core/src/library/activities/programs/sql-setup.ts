import { type ActivityCell } from "../activity-expected-answer";

type ColumnType = "integer" | "real" | "text";

export type SqlTable = {
  columns: readonly { name: string; type: ColumnType }[];
  name: string;
  rows: readonly (readonly ActivityCell[])[];
};

export type SqlStatement = { params: ActivityCell[]; sql: string };

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
  if (value === null || typeof value === "number" || typeof value === "string") {
    return value;
  }

  return JSON.stringify(value) ?? "";
}
