import { type Client, escapeIdentifier } from "pg";

const INSERT_BATCH_SIZE = 250;

/** A row with every value as the text Postgres printed, or null. */
export type DatabaseRow = Record<string, string | null>;

export type TableRows = { columns: string[]; rows: DatabaseRow[] };

/**
 * Keeps every value as the text Postgres printed, so a row is written back exactly as it was read:
 * JSON `null` stays apart from SQL NULL and timestamps never pass through the local time zone.
 */
const RAW_TEXT_TYPES = { getTypeParser: () => (value: unknown) => value };

/**
 * A connection runs one query at a time (and `pg` rejects overlapping ones), so work on one client
 * runs in order.
 */
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

/** The non-null values of one column, such as the ids of every row. */
export function getColumnValues(data: TableRows, column: string): string[] {
  return data.rows.flatMap((row) => {
    const value = row[column];
    return value === null || value === undefined ? [] : [value];
  });
}

export function getRowIds(data: TableRows): string[] {
  return getColumnValues(data, "id");
}

/** Replaces one column's value in every row, for foreign keys that point elsewhere in the destination. */
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

/** Clears a nullable foreign key whose row the destination doesn't have. */
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

async function insertBatches({
  batchIndex = 0,
  batches,
  columns,
  destination,
  inserted = [],
  suffix,
  table,
}: {
  batchIndex?: number;
  batches: DatabaseRow[][];
  columns: string[];
  destination: Client;
  inserted?: DatabaseRow[];
  suffix: string;
  table: string;
}): Promise<DatabaseRow[]> {
  const batch = batches[batchIndex];

  if (!batch) {
    return inserted;
  }

  const query = buildInsertQuery({ columns, rowCount: batch.length, suffix, table });
  const values = batch.flatMap((row) => columns.map((column) => row[column]));

  const result = await destination.query<DatabaseRow>({
    text: query,
    types: RAW_TEXT_TYPES,
    values,
  });

  return insertBatches({
    batchIndex: batchIndex + 1,
    batches,
    columns,
    destination,
    inserted: [...inserted, ...result.rows],
    suffix,
    table,
  });
}

/**
 * Inserts rows in batches. `suffix` adds an `ON CONFLICT` or `RETURNING` clause; the returned rows
 * are what `RETURNING` gave back.
 */
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
  return insertBatches({
    batches: getRowBatches(data.rows),
    columns: data.columns,
    destination,
    suffix,
    table,
  });
}

/**
 * Updates a destination row that already has the source row's natural key instead of inserting a
 * second one, leaving `keep` columns (the destination's id and its own counters) as they are.
 */
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
