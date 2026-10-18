import { logInfo } from "@zoonk/utils/logger";
import { type Client } from "pg";
import { type ContentTable, SEEDED_ROWS } from "./metadata";
import { type TableRows, mapColumn, readRows } from "./rows";
import { type SourceCatalog } from "./source";

const KEYED_TABLES = [
  "courses",
  "library_chapters",
  "library_lessons",
  "skills",
  "media_assets",
] as const;

type KeyedTable = (typeof KEYED_TABLES)[number];

/** Natural keys a row that stays holds, which a source row with the same key can't take. */
const NATURAL_KEYS: Record<KeyedTable, readonly string[]> = {
  courses: ["slug"],
  library_chapters: ["language", "identity_key"],
  library_lessons: ["language", "identity_key"],
  media_assets: ["reuse_key"],
  skills: ["language", "identity_key"],
};

type KeptKeys = Record<KeyedTable, ReadonlySet<string>>;

/**
 * Rows that can't exist without a parent row, parents first, so a row left out takes the rows that
 * need it along. Nullable links to a row left out are cleared later, like any link the copy lacks.
 */
const REQUIRED_PARENTS = [
  ["course_categories", "course_id", "courses"],
  ["course_chapters", "course_id", "courses"],
  ["course_chapters", "chapter_id", "library_chapters"],
  ["skill_prerequisites", "skill_id", "skills"],
  ["skill_prerequisites", "prerequisite_id", "skills"],
  ["items", "skill_id", "skills"],
  ["chapter_skills", "chapter_id", "library_chapters"],
  ["chapter_skills", "skill_id", "skills"],
  ["conversation_scenarios", "chapter_id", "library_chapters"],
  ["chapter_lessons", "chapter_id", "library_chapters"],
  ["chapter_lessons", "lesson_id", "library_lessons"],
  ["lesson_skills", "lesson_id", "library_lessons"],
  ["lesson_skills", "skill_id", "skills"],
  ["lesson_words", "lesson_id", "library_lessons"],
  ["lesson_sentences", "lesson_id", "library_lessons"],
  ["library_steps", "lesson_id", "library_lessons"],
  ["step_variants", "step_id", "library_steps"],
  ["answer_explanations", "step_id", "library_steps"],
  ["answer_explanations", "item_id", "items"],
] as const satisfies readonly (readonly [ContentTable, string, ContentTable])[];

type LeftOut = Partial<Record<ContentTable, ReadonlySet<string>>>;

function getKey(row: TableRows["rows"][number], columns: readonly string[]): string {
  return JSON.stringify(columns.map((column) => row[column]));
}

async function readKeys({
  destination,
  params = [],
  query,
  table,
}: {
  destination: Client;
  params?: unknown[];
  query: string;
  table: KeyedTable;
}): Promise<ReadonlySet<string>> {
  const columns = NATURAL_KEYS[table];

  const data = await readRows({
    client: destination,
    params,
    query: `SELECT ${columns.join(", ")} FROM ${table} WHERE ${query}`,
  });

  return new Set(data.rows.map((row) => getKey(row, columns)));
}

/** Library rows `markRemovedContent` didn't list: seeded and private content, and what they use. */
function readStayingKeys({ destination, table }: { destination: Client; table: KeyedTable }) {
  return readKeys({
    destination,
    query: `id NOT IN (SELECT id FROM sync_removed WHERE table_name = '${table}')`,
    table,
  });
}

/**
 * The natural keys the destination's staying rows hold: the slugs of seeded courses (the
 * organization's other courses take the source's by slug) and the keys of every Library row and
 * picture that stays. Run it after `markRemovedContent`.
 */
export async function readKeptKeys({
  destination,
  organizationId,
}: {
  destination: Client;
  organizationId: string;
}): Promise<KeptKeys> {
  // One connection runs one query at a time.
  const courses = await readKeys({
    destination,
    params: [organizationId],
    query: `${SEEDED_ROWS} AND organization_id = $1`,
    table: "courses",
  });

  const chapters = await readStayingKeys({ destination, table: "library_chapters" });
  const lessons = await readStayingKeys({ destination, table: "library_lessons" });
  const skills = await readStayingKeys({ destination, table: "skills" });
  const media = await readStayingKeys({ destination, table: "media_assets" });

  return {
    courses,
    library_chapters: chapters,
    library_lessons: lessons,
    media_assets: media,
    skills,
  };
}

function withoutRows({
  data,
  drop,
}: {
  data: TableRows;
  drop: (row: TableRows["rows"][number]) => boolean;
}) {
  const kept = data.rows.filter((row) => !drop(row));
  return { data: { ...data, rows: kept }, left: data.rows.filter((row) => drop(row)) };
}

function addLeftOut({
  leftOut,
  rows,
  table,
}: {
  leftOut: LeftOut;
  rows: TableRows["rows"];
  table: ContentTable;
}): LeftOut {
  const ids = rows.flatMap((row) => (row.id ? [row.id] : []));
  return { ...leftOut, [table]: new Set([...(leftOut[table] ?? []), ...ids]) };
}

/** Leaves out the source rows whose natural key a staying row holds. */
function leaveOutKeptKeys({ catalog, keys }: { catalog: SourceCatalog; keys: KeptKeys }) {
  const none: LeftOut = {};

  return KEYED_TABLES.reduce(
    (current, table) => {
      const { data, left } = withoutRows({
        data: current.catalog[table],
        drop: (row) => keys[table].has(getKey(row, NATURAL_KEYS[table])),
      });

      return {
        catalog: { ...current.catalog, [table]: data },
        leftOut: addLeftOut({ leftOut: current.leftOut, rows: left, table }),
      };
    },
    { catalog, leftOut: none },
  );
}

/** Leaves out the rows whose required parent was left out, parents first. */
function leaveOutOrphans({ catalog, leftOut }: { catalog: SourceCatalog; leftOut: LeftOut }) {
  return REQUIRED_PARENTS.reduce(
    (current, [table, column, parent]) => {
      const parents = current.leftOut[parent] ?? new Set<string>();

      const { data, left } = withoutRows({
        data: current.catalog[table],
        drop: (row) => parents.has(row[column] ?? ""),
      });

      return {
        catalog: { ...current.catalog, [table]: data },
        leftOut: addLeftOut({ leftOut: current.leftOut, rows: left, table }),
      };
    },
    { catalog, leftOut },
  );
}

/**
 * Leaves out source rows that share a natural key with a row that stays (a seeded course's slug, a
 * Library row's identity, a picture's reuse key), with the rows that need them: the local row stays
 * as it is. A skill merged into one left out is copied as not merged.
 */
export function withoutKeptKeys({
  catalog,
  keys,
}: {
  catalog: SourceCatalog;
  keys: KeptKeys;
}): SourceCatalog {
  const result = leaveOutOrphans(leaveOutKeptKeys({ catalog, keys }));

  const skills = mapColumn({
    column: "merged_into_id",
    data: result.catalog.skills,
    map: (id) => (result.leftOut.skills?.has(id) ? null : id),
  });

  const counts = Object.entries(result.leftOut)
    .filter(([, ids]) => ids.size > 0)
    .map(([table, ids]) => `${ids.size} ${table}`);

  if (counts.length > 0) {
    logInfo(`Left out source rows that share a key with local content: ${counts.join(", ")}`);
  }

  return { ...result.catalog, skills };
}
