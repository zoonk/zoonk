import { logInfo } from "@zoonk/utils/logger";
import { type Client } from "pg";
import { type ContentTable } from "./metadata";
import {
  type TableRows,
  getColumnValues,
  getRowIds,
  insertRows,
  keepKnownReferences,
  mapColumn,
  runInOrder,
} from "./rows";
import { type SourceCatalog } from "./source";
import { type IdMap, upsertCourses, upsertVocabulary } from "./upserts";

type Transform = (data: TableRows) => TableRows;
type TableCopy = readonly [ContentTable, TableRows];

/** Ids of rows the sync doesn't copy (sources, exam blueprints) that the destination already has. */
type ExistingIds = { blueprintIds: ReadonlySet<string>; sourceIds: ReadonlySet<string> };

function remap({ column, ids }: { column: string; ids: IdMap }): Transform {
  return (data) => mapColumn({ column, data, map: (id) => ids.get(id) ?? null });
}

function keepKnown({ column, known }: { column: string; known: ReadonlySet<string> }): Transform {
  return (data) => keepKnownReferences({ column, data, known });
}

function applyTransforms(data: TableRows, transforms: Transform[]): TableRows {
  return transforms.reduce((current, transform) => transform(current), data);
}

/** Tables are copied one after another so every foreign key finds the row it points at. */
async function copyTables({
  destination,
  tables,
}: {
  destination: Client;
  tables: readonly TableCopy[];
}): Promise<void> {
  await runInOrder(
    tables.map(([table, data]) => async () => {
      await insertRows({ data, destination, table });
      logInfo(`Copied ${data.rows.length} ${table}`);
    }),
  );
}

async function getExistingIds({
  destination,
  ids,
  table,
}: {
  destination: Client;
  ids: string[];
  table: "exam_blueprints" | "sources";
}): Promise<Set<string>> {
  const result = await destination.query<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`,
    [[...new Set(ids)]],
  );

  return new Set(result.rows.map((row) => row.id));
}

async function getExistingReferences({
  catalog,
  destination,
}: {
  catalog: SourceCatalog;
  destination: Client;
}): Promise<ExistingIds> {
  const blueprintIds = await getExistingIds({
    destination,
    ids: getColumnValues(catalog.items, "exam_blueprint_id"),
    table: "exam_blueprints",
  });

  const sourceIds = await getExistingIds({
    destination,
    ids: [
      ...getColumnValues(catalog.items, "source_id"),
      ...getColumnValues(catalog.library_steps, "source_id"),
    ],
    table: "sources",
  });

  return { blueprintIds, sourceIds };
}

/**
 * A skill can be merged into another skill that comes later in the copy, so merges are linked once
 * every skill exists.
 */
async function copySkills({
  destination,
  skills,
}: {
  destination: Client;
  skills: TableRows;
}): Promise<void> {
  const unmerged = mapColumn({ column: "merged_into_id", data: skills, map: () => null });
  await copyTables({ destination, tables: [["skills", unmerged]] });

  const merges = skills.rows.filter((row) => row.merged_into_id);

  await destination.query(
    `UPDATE skills SET merged_into_id = merge.merged_into_id
       FROM unnest($1::uuid[], $2::uuid[]) AS merge(id, merged_into_id)
      WHERE skills.id = merge.id`,
    [merges.map((row) => row.id), merges.map((row) => row.merged_into_id)],
  );
}

function getCurriculumTables({
  catalog,
  courseIds,
  existing,
}: {
  catalog: SourceCatalog;
  courseIds: IdMap;
  existing: ExistingIds;
}): TableCopy[] {
  const mediaIds = new Set(getRowIds(catalog.media_assets));
  const chapterIds = new Set(getRowIds(catalog.library_chapters));
  const byCourse = remap({ column: "course_id", ids: courseIds });
  const byImage = keepKnown({ column: "image_asset_id", known: mediaIds });

  const items = applyTransforms(catalog.items, [
    keepKnown({ column: "source_id", known: existing.sourceIds }),
    keepKnown({ column: "exam_blueprint_id", known: existing.blueprintIds }),
  ]);

  const chapters = applyTransforms(catalog.library_chapters, [
    remap({ column: "home_course_id", ids: courseIds }),
    byImage,
  ]);

  const lessons = applyTransforms(catalog.library_lessons, [
    keepKnown({ column: "home_chapter_id", known: chapterIds }),
    byImage,
  ]);

  return [
    ["course_categories", byCourse(catalog.course_categories)],
    ["media_assets", catalog.media_assets],
    ["skill_prerequisites", catalog.skill_prerequisites],
    ["items", items],
    ["library_chapters", chapters],
    ["course_chapters", byCourse(catalog.course_chapters)],
    ["chapter_skills", catalog.chapter_skills],
    ["conversation_scenarios", catalog.conversation_scenarios],
    ["library_lessons", lessons],
    ["chapter_lessons", catalog.chapter_lessons],
    ["lesson_skills", catalog.lesson_skills],
  ];
}

function getLessonContentTables({
  catalog,
  existing,
  sentenceIds,
  wordIds,
}: {
  catalog: SourceCatalog;
  existing: ExistingIds;
  sentenceIds: IdMap;
  wordIds: IdMap;
}): TableCopy[] {
  const byWord = remap({ column: "word_id", ids: wordIds });
  const bySentence = remap({ column: "sentence_id", ids: sentenceIds });

  const steps = applyTransforms(catalog.library_steps, [
    byWord,
    bySentence,
    keepKnown({ column: "skill_id", known: new Set(getRowIds(catalog.skills)) }),
    keepKnown({ column: "item_id", known: new Set(getRowIds(catalog.items)) }),
    keepKnown({ column: "media_asset_id", known: new Set(getRowIds(catalog.media_assets)) }),
    keepKnown({ column: "source_id", known: existing.sourceIds }),
  ]);

  return [
    ["lesson_words", byWord(catalog.lesson_words)],
    ["lesson_sentences", bySentence(catalog.lesson_sentences)],
    ["library_steps", steps],
    ["step_variants", catalog.step_variants],
    ["answer_explanations", catalog.answer_explanations],
  ];
}

/**
 * Writes the source catalog into the cleared destination. Rows keep their source ids; foreign keys
 * to rows the destination kept under its own id (courses, words, sentences) are mapped, and nullable
 * links to rows the sync doesn't copy are cleared unless the destination already has that row.
 */
export async function copyCatalog({
  catalog,
  destination,
  organizationId,
}: {
  catalog: SourceCatalog;
  destination: Client;
  organizationId: string;
}): Promise<void> {
  const existing = await getExistingReferences({ catalog, destination });
  const courseIds = await upsertCourses({ catalog, destination, organizationId });

  logInfo(`Copied ${catalog.courses.rows.length} courses`);

  await copySkills({ destination, skills: catalog.skills });
  await copyTables({ destination, tables: getCurriculumTables({ catalog, courseIds, existing }) });

  const { sentenceIds, wordIds } = await upsertVocabulary({ catalog, destination, organizationId });

  logInfo(
    `Copied ${catalog.words.rows.length} words and ${catalog.sentences.rows.length} sentences`,
  );

  await copyTables({
    destination,
    tables: getLessonContentTables({ catalog, existing, sentenceIds, wordIds }),
  });
}
