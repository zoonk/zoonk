import { type Client, escapeIdentifier } from "pg";

const INSERT_BATCH_SIZE = 250;

export type DatabaseRow = Record<string, string | null>;

export type TableRows = { columns: string[]; rows: DatabaseRow[] };

/** JSON keeps null values and separators inside text unambiguous. */
export function getRowKey(row: DatabaseRow, columns: readonly string[]): string {
  return JSON.stringify(columns.map((column) => row[column]));
}

/**
 * Keeps every value as the text Postgres printed, so a row is written back exactly as it was read:
 * JSON `null` stays apart from SQL NULL and timestamps never pass through the local time zone.
 */
const RAW_TEXT_TYPES = { getTypeParser: () => (value: unknown) => value };

/** A connection runs one query at a time, and `pg` rejects overlapping ones. */
export async function runInOrder<Result>(
  tasks: readonly (() => Promise<Result>)[],
): Promise<Result[]> {
  return tasks.reduce<Promise<Result[]>>(
    async (previous, task) => [...(await previous), await task()],
    Promise.resolve([]),
  );
}

export async function readRows({
  client,
  params = [],
  query,
}: {
  client: Client;
  params?: unknown[];
  query: string;
}): Promise<TableRows> {
  const result = await client.query<DatabaseRow>({
    text: query,
    types: RAW_TEXT_TYPES,
    values: params,
  });

  return { columns: result.fields.map((field) => field.name), rows: result.rows };
}

export function getColumnValues(data: TableRows, column: string): string[] {
  return data.rows.flatMap((row) => {
    const value = row[column];
    return value === null || value === undefined ? [] : [value];
  });
}

export function getRowIds(data: TableRows): string[] {
  return getColumnValues(data, "id");
}

export function mapColumn({
  column,
  data,
  map,
}: {
  column: string;
  data: TableRows;
  map: (value: string) => string | null;
}): TableRows {
  return {
    ...data,
    rows: data.rows.map((row) => {
      const value = row[column];
      return { ...row, [column]: value ? map(value) : null };
    }),
  };
}

export function keepKnownReferences({
  column,
  data,
  known,
}: {
  column: string;
  data: TableRows;
  known: ReadonlySet<string>;
}): TableRows {
  return mapColumn({ column, data, map: (value) => (known.has(value) ? value : null) });
}

function getRowPlaceholders({ columnCount, rowIndex }: { columnCount: number; rowIndex: number }) {
  const firstParameter = rowIndex * columnCount + 1;
  return `(${Array.from({ length: columnCount }, (_, index) => `$${firstParameter + index}`).join(", ")})`;
}

function buildInsertQuery({
  columns,
  rowCount,
  suffix,
  table,
}: {
  columns: string[];
  rowCount: number;
  suffix: string;
  table: string;
}): string {
  const quotedColumns = columns.map((column) => escapeIdentifier(column)).join(", ");

  const placeholders = Array.from({ length: rowCount }, (_, rowIndex) =>
    getRowPlaceholders({ columnCount: columns.length, rowIndex }),
  ).join(", ");

  return `INSERT INTO ${escapeIdentifier(table)} (${quotedColumns}) VALUES ${placeholders} ${suffix}`;
}

function getRowBatches(rows: DatabaseRow[]): DatabaseRow[][] {
  const batchCount = Math.ceil(rows.length / INSERT_BATCH_SIZE);

  return Array.from({ length: batchCount }, (_, batchIndex) => {
    const offset = batchIndex * INSERT_BATCH_SIZE;
    return rows.slice(offset, offset + INSERT_BATCH_SIZE);
  });
}

/** `suffix` adds an `ON CONFLICT` or `RETURNING` clause. */
export async function insertRows({
  data,
  destination,
  suffix = "",
  table,
}: {
  data: TableRows;
  destination: Client;
  suffix?: string;
  table: string;
}): Promise<DatabaseRow[]> {
  const inserted: DatabaseRow[] = [];

  for (const batch of getRowBatches(data.rows)) {
    // oxlint-disable-next-line no-await-in-loop -- One client writes each batch in order and stops on failure.
    const result = await destination.query<DatabaseRow>({
      text: buildInsertQuery({ columns: data.columns, rowCount: batch.length, suffix, table }),
      types: RAW_TEXT_TYPES,
      values: batch.flatMap((row) => data.columns.map((column) => row[column])),
    });

    inserted.push(...result.rows);
  }

  return inserted;
}

export function getUpsertClause({
  columns,
  conflict,
  keep,
  returning,
}: {
  columns: string[];
  conflict: string[];
  keep: string[];
  returning: string[];
}): string {
  const assignments = columns
    .filter((column) => !conflict.includes(column) && !keep.includes(column))
    .map((column) => `${escapeIdentifier(column)} = EXCLUDED.${escapeIdentifier(column)}`);

  const target = conflict.map((column) => escapeIdentifier(column)).join(", ");
  const returned = returning.map((column) => escapeIdentifier(column)).join(", ");

  return `ON CONFLICT (${target}) DO UPDATE SET ${assignments.join(", ")} RETURNING ${returned}`;
}
