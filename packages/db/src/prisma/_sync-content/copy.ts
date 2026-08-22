import { logInfo } from "@zoonk/utils/logger";
import { type Client } from "pg";
import { type ContentIds, type ContentTable } from "./metadata";

const INSERT_BATCH_SIZE = 250;

type DatabaseRow = Record<string, unknown>;
type RowTransform = (row: DatabaseRow) => DatabaseRow;

type CopyTableOptions = {
  destination: Client;
  params: unknown[];
  query: string;
  source: Client;
  table: ContentTable;
  transform?: RowTransform;
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function getRowPlaceholders({ columnCount, rowIndex }: { columnCount: number; rowIndex: number }) {
  const firstParameter = rowIndex * columnCount + 1;
  return `(${Array.from({ length: columnCount }, (_, index) => `$${firstParameter + index}`).join(", ")})`;
}

function buildInsertQuery({
  columns,
  rowCount,
  table,
}: {
  columns: string[];
  rowCount: number;
  table: ContentTable;
}): string {
  const quotedColumns = columns.map((column) => quoteIdentifier(column)).join(", ");

  const placeholders = Array.from({ length: rowCount }, (_, rowIndex) =>
    getRowPlaceholders({ columnCount: columns.length, rowIndex }),
  ).join(", ");

  return `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES ${placeholders}`;
}

function getRowValues({ columns, row }: { columns: string[]; row: DatabaseRow }): unknown[] {
  return columns.map((column) => row[column]);
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
  table,
}: {
  batchIndex?: number;
  batches: DatabaseRow[][];
  columns: string[];
  destination: Client;
  table: ContentTable;
}): Promise<void> {
  const batch = batches[batchIndex];

  if (!batch) {
    return;
  }

  const query = buildInsertQuery({ columns, rowCount: batch.length, table });
  const values = batch.flatMap((row) => getRowValues({ columns, row }));

  await destination.query(query, values);
  await insertBatches({ batchIndex: batchIndex + 1, batches, columns, destination, table });
}

async function insertRows({
  columns,
  destination,
  rows,
  table,
}: {
  columns: string[];
  destination: Client;
  rows: DatabaseRow[];
  table: ContentTable;
}): Promise<void> {
  const batches = getRowBatches(rows);
  await insertBatches({ batches, columns, destination, table });
}

async function copyTable({
  destination,
  params,
  query,
  source,
  table,
  transform = (row) => row,
}: CopyTableOptions): Promise<number> {
  const result = await source.query<DatabaseRow>(query, params);

  if (result.rows.length === 0) {
    return 0;
  }

  const columns = result.fields.map((field) => field.name);
  const rows = result.rows.map((row) => transform(row));

  await insertRows({ columns, destination, rows, table });
  return rows.length;
}

function remapOrganization({
  destinationOrganizationId,
  row,
}: {
  destinationOrganizationId: string;
  row: DatabaseRow;
}): DatabaseRow {
  return { ...row, organization_id: destinationOrganizationId };
}

function remapCourse({
  destinationOrganizationId,
  row,
}: {
  destinationOrganizationId: string;
  row: DatabaseRow;
}): DatabaseRow {
  return { ...remapOrganization({ destinationOrganizationId, row }), user_count: 0, user_id: null };
}

async function copyTableAndLog(copySpec: CopyTableOptions): Promise<void> {
  const rowCount = await copyTable(copySpec);
  logInfo(`Copied ${rowCount} ${copySpec.table}`);
}

function getCopySpecs({
  destination,
  destinationOrganizationId,
  ids,
  source,
  sourceOrganizationId,
}: {
  destination: Client;
  destinationOrganizationId: string;
  ids: ContentIds;
  source: Client;
  sourceOrganizationId: string;
}): Record<ContentTable, CopyTableOptions> {
  const remapOwnedRow = (row: DatabaseRow) => remapOrganization({ destinationOrganizationId, row });
  const remapCourseRow = (row: DatabaseRow) => remapCourse({ destinationOrganizationId, row });

  return {
    chapter_sentences: {
      destination,
      params: [ids.chapterIds],
      query: "SELECT * FROM chapter_sentences WHERE chapter_id = ANY($1::uuid[]) ORDER BY id",
      source,
      table: "chapter_sentences",
    },
    chapter_words: {
      destination,
      params: [ids.chapterIds],
      query: "SELECT * FROM chapter_words WHERE chapter_id = ANY($1::uuid[]) ORDER BY id",
      source,
      table: "chapter_words",
    },
    chapters: {
      destination,
      params: [ids.courseIds],
      query: "SELECT * FROM chapters WHERE course_id = ANY($1::uuid[]) ORDER BY id",
      source,
      table: "chapters",
      transform: remapOwnedRow,
    },
    course_categories: {
      destination,
      params: [ids.courseIds],
      query: "SELECT * FROM course_categories WHERE course_id = ANY($1::uuid[]) ORDER BY id",
      source,
      table: "course_categories",
    },
    courses: {
      destination,
      params: [sourceOrganizationId],
      query: "SELECT * FROM courses WHERE organization_id = $1 AND user_id IS NULL ORDER BY id",
      source,
      table: "courses",
      transform: remapCourseRow,
    },
    lessons: {
      destination,
      params: [ids.chapterIds],
      query: "SELECT * FROM lessons WHERE chapter_id = ANY($1::uuid[]) ORDER BY id",
      source,
      table: "lessons",
      transform: remapOwnedRow,
    },
    sentences: {
      destination,
      params: [sourceOrganizationId],
      query: "SELECT * FROM sentences WHERE organization_id = $1 ORDER BY id",
      source,
      table: "sentences",
      transform: remapOwnedRow,
    },
    steps: {
      destination,
      params: [ids.lessonIds],
      query: "SELECT * FROM steps WHERE lesson_id = ANY($1::uuid[]) ORDER BY id",
      source,
      table: "steps",
    },
    word_pronunciations: {
      destination,
      params: [ids.wordIds],
      query: "SELECT * FROM word_pronunciations WHERE word_id = ANY($1::uuid[]) ORDER BY id",
      source,
      table: "word_pronunciations",
    },
    words: {
      destination,
      params: [sourceOrganizationId],
      query: "SELECT * FROM words WHERE organization_id = $1 ORDER BY id",
      source,
      table: "words",
      transform: remapOwnedRow,
    },
  };
}

export async function copyContent({
  destination,
  destinationOrganizationId,
  ids,
  source,
  sourceOrganizationId,
}: {
  destination: Client;
  destinationOrganizationId: string;
  ids: ContentIds;
  source: Client;
  sourceOrganizationId: string;
}): Promise<void> {
  const copySpecs = getCopySpecs({
    destination,
    destinationOrganizationId,
    ids,
    source,
    sourceOrganizationId,
  });

  await copyTableAndLog(copySpecs.courses);
  await copyTableAndLog(copySpecs.course_categories);
  await copyTableAndLog(copySpecs.chapters);
  await copyTableAndLog(copySpecs.words);
  await copyTableAndLog(copySpecs.sentences);
  await copyTableAndLog(copySpecs.lessons);
  await copyTableAndLog(copySpecs.word_pronunciations);
  await copyTableAndLog(copySpecs.chapter_words);
  await copyTableAndLog(copySpecs.chapter_sentences);
  await copyTableAndLog(copySpecs.steps);
}
