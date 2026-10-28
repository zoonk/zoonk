import { type Client, type QueryResultRow } from "pg";

/** In the order the copy inserts them. */
export const CONTENT_TABLES = [
  "course_families",
  "courses",
  "course_categories",
  "media_assets",
  "skills",
  "skill_prerequisites",
  "items",
  "library_chapters",
  "course_chapters",
  "chapter_skills",
  "conversation_scenarios",
  "library_lessons",
  "chapter_lessons",
  "lesson_skills",
  "words",
  "word_pronunciations",
  "sentences",
  "lesson_words",
  "lesson_sentences",
  "library_steps",
  "step_variants",
  "answer_explanations",
] as const;

export type ContentTable = (typeof CONTENT_TABLES)[number];

/** Private rows belong to one learner's goal: they never leave the source or get replaced here. */
export const PUBLIC_ROWS = "visibility = 'public' AND owner_id IS NULL";

/**
 * The v2 seed's ids are UUID version 8, which generated content never has. Seeded content belongs
 * to the local database, so the sync never reads, removes or overwrites it.
 */
export const SEEDED_ROWS = "uuid_extract_version(id) = 8";

export const NOT_SEEDED = `NOT (${SEEDED_ROWS})`;

export const CATALOG_ROWS = `${PUBLIC_ROWS} AND ${NOT_SEEDED}`;

type TableColumn = QueryResultRow & {
  column_name: string;
  data_type: string;
  table_name: ContentTable;
  udt_name: string;
};

function getColumnKey(column: TableColumn): string {
  return `${column.table_name}.${column.column_name}`;
}

function getColumnType(column: TableColumn): string {
  return `${column.data_type}:${column.udt_name}`;
}

function getColumnTypes(columns: TableColumn[]): Map<string, string> {
  return new Map(columns.map((column) => [getColumnKey(column), getColumnType(column)]));
}

async function getTableColumns(client: Client): Promise<TableColumn[]> {
  const result = await client.query<TableColumn>(
    `SELECT table_name, column_name, data_type, udt_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position`,
    [CONTENT_TABLES],
  );

  return result.rows;
}

export async function assertCompatibleSchemas({
  destination,
  source,
}: {
  destination: Client;
  source: Client;
}): Promise<void> {
  const [sourceColumns, destinationColumns] = await Promise.all([
    getTableColumns(source),
    getTableColumns(destination),
  ]);

  const sourceTypes = getColumnTypes(sourceColumns);
  const destinationTypes = getColumnTypes(destinationColumns);

  const incompatibleColumn = sourceColumns.find(
    (column) =>
      destinationTypes.get(getColumnKey(column)) !== sourceTypes.get(getColumnKey(column)),
  );

  if (incompatibleColumn) {
    throw new Error(`Incompatible destination column: ${getColumnKey(incompatibleColumn)}`);
  }
}

export async function getOrganizationId({
  client,
  slug,
}: {
  client: Client;
  slug: string;
}): Promise<string> {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM organizations WHERE slug = $1",
    [slug],
  );

  const organization = result.rows[0];

  if (!organization) {
    throw new Error(`Missing organization: ${slug}`);
  }

  return organization.id;
}
