import { prisma, sql } from "@zoonk/db";
import { type JsonObject } from "@zoonk/utils/json";

/** A learner's rows are the ones deleting their user takes, as account deletion does. */
export const USERS_TABLE = "users";

/**
 * Tables in a learner's cascade that aren't their learning: sign-in and billing, which a copy gets
 * its own of; organization seats; and admin quality runs.
 */
const NOT_LEARNING = new Set([
  "accounts",
  "evaluation_runs",
  "invitations",
  "members",
  "sessions",
  "subscriptions",
]);

/** Other people's answers, kept without them on shared content, never one learner's. */
const ANONYMOUS_PREFIX = "anonymous_";

type ForeignKey = { cascades: boolean; child: string; column: string; parent: string };

export type LearnerRow = JsonObject;

export type LearnerColumn = { name: string; type: string };

export type LearnerTable = {
  columns: LearnerColumn[];
  name: string;
  rows: LearnerRow[];
  /** Columns pointing at another row of the same table, which has to be written first. */
  selfReferences: string[];
};

/** Quotes a table or column name the catalog gave, for the statements that name them. */
export function quoteName(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function isLearning(table: string): boolean {
  return !NOT_LEARNING.has(table) && !table.startsWith(ANONYMOUS_PREFIX);
}

async function readForeignKeys(): Promise<ForeignKey[]> {
  const keys = await prisma.$queryRaw<(ForeignKey & { columns: number; referenced: string })[]>(sql`
    SELECT
      child.relname AS child,
      parent.relname AS parent,
      child_column.attname AS "column",
      parent_column.attname AS referenced,
      key.confdeltype = 'c' AS cascades,
      cardinality(key.conkey) AS columns
    FROM pg_constraint key
    JOIN pg_class child ON child.oid = key.conrelid
    JOIN pg_class parent ON parent.oid = key.confrelid
    JOIN pg_attribute child_column ON child_column.attrelid = key.conrelid AND child_column.attnum = key.conkey[1]
    JOIN pg_attribute parent_column ON parent_column.attrelid = key.confrelid AND parent_column.attnum = key.confkey[1]
    WHERE key.contype = 'f' AND key.connamespace = current_schema()::regnamespace
  `);

  // Copies remap ids, so every reference has to be one column pointing at an `id`.
  const unsupported = keys.find((key) => key.columns !== 1 || key.referenced !== "id");

  if (unsupported) {
    throw new Error(
      `${unsupported.child} references ${unsupported.parent} by something other than its id; copying learners doesn't support that yet.`,
    );
  }

  return keys.map(({ cascades, child, column, parent }) => ({ cascades, child, column, parent }));
}

async function readColumns(): Promise<Map<string, LearnerColumn[]>> {
  const columns = await prisma.$queryRaw<(LearnerColumn & { table: string })[]>(sql`
    SELECT table_name AS "table", column_name AS name, data_type AS type
    FROM information_schema.columns
    WHERE table_schema = current_schema()
    ORDER BY table_name, ordinal_position
  `);

  return Map.groupBy(columns, (column) => column.table);
}

/** Every table deleting a user reaches through cascading references, except the ones not learning. */
function listLearnerTables(keys: ForeignKey[], tables: ReadonlySet<string>): Set<string> {
  const reached = keys
    .filter((key) => key.cascades && tables.has(key.parent) && !tables.has(key.child))
    .map((key) => key.child)
    .filter((table) => isLearning(table));

  return reached.length === 0
    ? new Set(tables)
    : listLearnerTables(keys, new Set([...tables, ...reached]));
}

/** Tables in an order that writes every referenced row before the rows pointing at it. */
function orderParentsFirst(keys: ForeignKey[], tables: ReadonlySet<string>): string[] {
  if (tables.size === 0) {
    return [];
  }

  const ready = [...tables].filter((table) =>
    keys.every((key) => key.child !== table || key.parent === table || !tables.has(key.parent)),
  );

  if (ready.length === 0) {
    throw new Error(`These tables reference each other in a cycle: ${[...tables].join(", ")}.`);
  }

  const rest = new Set([...tables].filter((table) => !ready.includes(table)));

  return [...ready.toSorted(), ...orderParentsFirst(keys, rest)];
}

async function readRows({
  filters,
  table,
}: {
  filters: { column: string; ids: string[] }[];
  table: string;
}): Promise<LearnerRow[]> {
  const used = filters.filter((filter) => filter.ids.length > 0);

  if (used.length === 0) {
    return [];
  }

  const conditions = used.map(
    (filter, index) => `${quoteName(filter.column)} = ANY($${index + 1}::uuid[])`,
  );

  const rows = await prisma.$queryRawUnsafe<{ row: LearnerRow }[]>(
    `SELECT to_jsonb(learner_row) AS row FROM ${quoteName(table)} learner_row WHERE ${conditions.join(" OR ")}`,
    ...used.map((filter) => filter.ids),
  );

  return rows.map(({ row }) => row);
}

export function listIds(rows: LearnerRow[]): string[] {
  return rows.flatMap((row) => (typeof row.id === "string" ? [row.id] : []));
}

/** A table's rows are the ones a cascading reference ties to rows of the learner already read. */
function listFilters({
  ids,
  keys,
  table,
  userId,
}: {
  ids: ReadonlyMap<string, string[]>;
  keys: ForeignKey[];
  table: string;
  userId: string;
}) {
  if (table === USERS_TABLE) {
    return [{ column: "id", ids: [userId] }];
  }

  return keys
    .filter((key) => key.cascades && key.child === table && key.parent !== table)
    .map((key) => ({ column: key.column, ids: ids.get(key.parent) ?? [] }));
}

/** Reads the tables in order: each one's rows are found from the rows of the tables before it. */
async function readTables({
  columns,
  ids,
  keys,
  tables,
  userId,
}: {
  columns: ReadonlyMap<string, LearnerColumn[]>;
  ids: ReadonlyMap<string, string[]>;
  keys: ForeignKey[];
  tables: string[];
  userId: string;
}): Promise<LearnerTable[]> {
  const [table, ...rest] = tables;

  if (!table) {
    return [];
  }

  const rows = await readRows({ filters: listFilters({ ids, keys, table, userId }), table });

  const read = {
    columns: columns.get(table) ?? [],
    name: table,
    rows,
    selfReferences: keys
      .filter((key) => key.child === table && key.parent === table)
      .map((key) => key.column),
  };

  const later = await readTables({
    columns,
    ids: new Map([...ids, [table, listIds(rows)]]),
    keys,
    tables: rest,
    userId,
  });

  return [read, ...later];
}

/**
 * Reads everything of one learner that deleting their account would delete, with referenced rows
 * first: their goals, plans, sessions, answers, memory and private content. Shared Library content
 * has no owner, so it stays out and their rows keep pointing at it.
 */
export async function readLearner(userId: string): Promise<LearnerTable[]> {
  const [keys, columns] = await Promise.all([readForeignKeys(), readColumns()]);
  const tables = orderParentsFirst(keys, listLearnerTables(keys, new Set([USERS_TABLE])));

  return readTables({ columns, ids: new Map(), keys, tables, userId });
}
