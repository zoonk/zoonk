import { logInfo } from "@zoonk/utils/logger";
import { type Client, escapeIdentifier, escapeLiteral } from "pg";
import { CATALOG_ROWS, CONTENT_TABLES, type ContentTable, NOT_SEEDED } from "./metadata";
import { LEARNER_REFERENCES } from "./preserve";
import { runInOrder } from "./rows";

/** Public Library tables: every public row not seeded is the AI organization's catalog. */
const PUBLIC_LIBRARY_TABLES = ["library_lessons", "library_chapters", "skills"] as const;

/** Pictures content shows; one that content staying here shows stays with it. */
const PICTURE_LINKS = [
  { column: "media_asset_id", table: "library_steps" },
  { column: "image_asset_id", table: "library_lessons" },
  { column: "image_asset_id", table: "library_chapters" },
] as const;

/** Rows removed with their parent, listed so references to them are checked and kept too. */
const CHILD_REMOVALS = [
  { column: "lesson_id", parent: "library_lessons", table: "library_steps" },
  { column: "skill_id", parent: "skills", table: "items" },
] as const;

const REMOVED_TABLES: readonly ContentTable[] = [
  "courses",
  ...PUBLIC_LIBRARY_TABLES,
  "media_assets",
  ...CHILD_REMOVALS.map((removal) => removal.table),
];

function selectPublicRows(table: string): string {
  return `SELECT ${escapeLiteral(table)}, id FROM ${escapeIdentifier(table)} WHERE ${CATALOG_ROWS}`;
}

function selectChildRows({ column, parent, table }: (typeof CHILD_REMOVALS)[number]): string {
  return `SELECT ${escapeLiteral(table)}, id FROM ${escapeIdentifier(table)}
           WHERE ${escapeIdentifier(column)} IN
                 (SELECT id FROM sync_removed WHERE table_name = ${escapeLiteral(parent)})`;
}

function selectKeptPictures({ column, table }: (typeof PICTURE_LINKS)[number]): string {
  return `SELECT ${escapeIdentifier(column)} FROM ${escapeIdentifier(table)}
           WHERE ${escapeIdentifier(column)} IS NOT NULL
             AND id NOT IN (SELECT id FROM sync_removed WHERE table_name = ${escapeLiteral(table)})`;
}

/** Catalog pictures, except those content that stays (such as a seeded lesson's steps) shows. */
function selectReplacedPictures(): string {
  return `SELECT 'media_assets', id FROM media_assets
           WHERE ${CATALOG_ROWS}
             AND id NOT IN (${PICTURE_LINKS.map((link) => selectKeptPictures(link)).join(" UNION ")})`;
}

type ForeignKey = { column_name: string; referenced_table: string; table_name: string };

/**
 * Records which destination rows the sync replaces: the AI organization's courses the source no
 * longer has (the others are updated in place) and every public Library row with the rows removed
 * with them. Learners' own courses, private content and seeded content are never listed, nor the
 * rows under them and the pictures they show.
 */
export async function markRemovedContent({
  courseSlugs,
  destination,
  organizationId,
}: {
  courseSlugs: string[];
  destination: Client;
  organizationId: string;
}): Promise<void> {
  const ownCourses = await destination.query<{ slug: string }>(
    "SELECT slug FROM courses WHERE organization_id = $1 AND user_id IS NOT NULL AND slug = ANY($2)",
    [organizationId, courseSlugs],
  );

  if (ownCourses.rows[0]) {
    throw new Error(`A local learner's course uses the catalog slug "${ownCourses.rows[0].slug}"`);
  }

  await destination.query(
    `CREATE TEMP TABLE sync_removed (
       table_name text NOT NULL,
       id uuid NOT NULL,
       PRIMARY KEY (table_name, id)
     ) ON COMMIT DROP`,
  );

  await destination.query(
    `INSERT INTO sync_removed
     SELECT 'courses', id FROM courses
      WHERE organization_id = $1 AND user_id IS NULL AND ${NOT_SEEDED} AND slug <> ALL($2::text[])`,
    [organizationId, courseSlugs],
  );

  await destination.query(
    `INSERT INTO sync_removed ${PUBLIC_LIBRARY_TABLES.map((table) => selectPublicRows(table)).join(" UNION ALL ")}`,
  );

  await destination.query(
    `INSERT INTO sync_removed ${CHILD_REMOVALS.map((removal) => selectChildRows(removal)).join(" UNION ALL ")}`,
  );

  await destination.query(`INSERT INTO sync_removed ${selectReplacedPictures()}`);
}

function isCheckedReference(foreignKey: ForeignKey): boolean {
  const table = foreignKey.table_name;

  const isLearnerReference = LEARNER_REFERENCES.some(
    (reference) => reference.table === table && reference.column === foreignKey.column_name,
  );

  const isCopiedChild =
    CONTENT_TABLES.some((content) => content === table) &&
    !REMOVED_TABLES.some((removed) => removed === table);

  return !isLearnerReference && !isCopiedChild;
}

/** A replaced table's own rows only count when they stay, such as a private lesson's step. */
function getKeptRowsFilter(table: string): string {
  return REMOVED_TABLES.some((removed) => removed === table)
    ? `AND ref.id NOT IN (SELECT id FROM sync_removed WHERE table_name = ${escapeLiteral(table)})`
    : "";
}

async function countReferences({
  destination,
  foreignKey,
}: {
  destination: Client;
  foreignKey: ForeignKey;
}): Promise<number> {
  const table = escapeIdentifier(foreignKey.table_name);
  const column = escapeIdentifier(foreignKey.column_name);

  const result = await destination.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${table} ref
      WHERE ref.${column} IN (SELECT id FROM sync_removed WHERE table_name = $1)
        ${getKeptRowsFilter(foreignKey.table_name)}`,
    [foreignKey.referenced_table],
  );

  return result.rows[0]?.count ?? 0;
}

/**
 * Stops before anything is removed when rows the sync can't restore point at the rows it replaces:
 * a local learner's goal on a course the source doesn't have, or rows from tables this sync doesn't
 * know. Learner references it knows are kept by `preserve.ts`, and copied child rows are replaced
 * with their parents.
 */
export async function assertNoUnkeptReferences(destination: Client): Promise<void> {
  const foreignKeys = await destination.query<ForeignKey>(
    `SELECT constraints.conrelid::regclass::text AS table_name,
            columns.attname AS column_name,
            constraints.confrelid::regclass::text AS referenced_table
       FROM pg_constraint constraints
       JOIN pg_attribute columns
         ON columns.attrelid = constraints.conrelid AND columns.attnum = constraints.conkey[1]
      WHERE constraints.contype = 'f'
        AND cardinality(constraints.conkey) = 1
        AND constraints.confrelid::regclass::text = ANY($1::text[])
      ORDER BY 1, 2`,
    [REMOVED_TABLES],
  );

  const checked = foreignKeys.rows.filter((foreignKey) => isCheckedReference(foreignKey));

  const counts = await runInOrder(
    checked.map((foreignKey) => async () => ({
      count: await countReferences({ destination, foreignKey }),
      foreignKey,
    })),
  );

  const blocking = counts.filter(({ count }) => count > 0);

  if (blocking.length > 0) {
    const list = blocking
      .map(
        ({ count, foreignKey }) => `${foreignKey.table_name}.${foreignKey.column_name} (${count})`,
      )
      .join(", ");

    throw new Error(
      `Local rows point at AI catalog content the sync replaces and can't restore: ${list}`,
    );
  }
}

/**
 * Removes the rows `markRemovedContent` listed. Their steps, items, placements and links go with
 * them; categories of the courses updated in place are replaced too, and seeded courses keep theirs.
 */
export async function clearDestinationContent({
  destination,
  organizationId,
}: {
  destination: Client;
  organizationId: string;
}): Promise<void> {
  const removed = await runInOrder(
    ["courses", ...PUBLIC_LIBRARY_TABLES, "media_assets"].map((table) => async () => {
      const result = await destination.query(
        `DELETE FROM ${escapeIdentifier(table)}
          WHERE id IN (SELECT id FROM sync_removed WHERE table_name = $1)`,
        [table],
      );

      return `${result.rowCount ?? 0} ${table}`;
    }),
  );

  await destination.query(
    `DELETE FROM course_categories
      WHERE course_id IN (SELECT id FROM courses
                           WHERE organization_id = $1 AND user_id IS NULL AND ${NOT_SEEDED})`,
    [organizationId],
  );

  logInfo(`Removed ${removed.join(", ")} from local zoonk`);
}
