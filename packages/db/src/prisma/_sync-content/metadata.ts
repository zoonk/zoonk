import { type Client, type QueryResultRow } from "pg";

const CONTENT_TABLES = [
  "courses",
  "course_categories",
  "chapters",
  "lessons",
  "words",
  "word_pronunciations",
  "sentences",
  "chapter_words",
  "chapter_sentences",
  "steps",
] as const;

export type ContentTable = (typeof CONTENT_TABLES)[number];

export type ContentIds = {
  chapterIds: string[];
  courseIds: string[];
  lessonIds: string[];
  sentenceIds: string[];
  wordIds: string[];
};

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

async function getIds({
  client,
  params,
  query,
}: {
  client: Client;
  params: unknown[];
  query: string;
}): Promise<string[]> {
  const result = await client.query<{ id: string }>(query, params);
  return result.rows.map((row) => row.id);
}

export async function getContentIds({
  organizationId,
  source,
}: {
  organizationId: string;
  source: Client;
}): Promise<ContentIds> {
  const courseIds = await getIds({
    client: source,
    params: [organizationId],
    query: "SELECT id FROM courses WHERE organization_id = $1 AND user_id IS NULL ORDER BY id",
  });

  const chapterIds = await getIds({
    client: source,
    params: [courseIds],
    query: "SELECT id FROM chapters WHERE course_id = ANY($1::uuid[]) ORDER BY id",
  });

  const wordIds = await getIds({
    client: source,
    params: [organizationId],
    query: "SELECT id FROM words WHERE organization_id = $1 ORDER BY id",
  });

  const sentenceIds = await getIds({
    client: source,
    params: [organizationId],
    query: "SELECT id FROM sentences WHERE organization_id = $1 ORDER BY id",
  });

  const lessonIds = await getIds({
    client: source,
    params: [chapterIds],
    query: "SELECT id FROM lessons WHERE chapter_id = ANY($1::uuid[]) ORDER BY id",
  });

  return { chapterIds, courseIds, lessonIds, sentenceIds, wordIds };
}
