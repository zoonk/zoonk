import { type Client } from "pg";
import { CATALOG_ROWS, type ContentTable, NOT_SEEDED, PUBLIC_ROWS } from "./metadata";
import { type TableRows, getColumnValues, getRowIds, readRows } from "./rows";

export type SourceCatalog = Record<ContentTable, TableRows>;

type Reader = (query: string, ...params: unknown[]) => Promise<TableRows>;

/** Rows are filtered by the ids of copied parents: `[column, ids]`. */
type ParentIds = readonly [string, string[]];

function getReader(source: Client): Reader {
  return (query, ...params) => readRows({ client: source, params, query });
}

async function readCourses({ organizationId, read }: { organizationId: string; read: Reader }) {
  const courses = await read(
    `SELECT * FROM courses
      WHERE organization_id = $1 AND user_id IS NULL AND visibility = 'public' AND ${NOT_SEEDED}
      ORDER BY id`,
    organizationId,
  );

  const families = await read(
    "SELECT * FROM course_families WHERE id = ANY($1::uuid[]) ORDER BY id",
    getColumnValues(courses, "family_id"),
  );

  const categories = await read(
    "SELECT * FROM course_categories WHERE course_id = ANY($1::uuid[]) ORDER BY id",
    getRowIds(courses),
  );

  return { categories, courses, families };
}

/** Items made from a learner's private upload or for a private exam stay private with it. */
async function readSkills(read: Reader) {
  const skills = await read(`SELECT * FROM skills WHERE ${CATALOG_ROWS} ORDER BY id`);
  const skillIds = getRowIds(skills);

  const prerequisites = await read(
    `SELECT * FROM skill_prerequisites
      WHERE skill_id = ANY($1::uuid[]) AND prerequisite_id = ANY($1::uuid[])
      ORDER BY skill_id, prerequisite_id`,
    skillIds,
  );

  const items = await read(
    `SELECT * FROM items
      WHERE skill_id = ANY($1::uuid[])
        AND (source_id IS NULL OR source_id IN (SELECT id FROM sources WHERE ${PUBLIC_ROWS}))
        AND (exam_blueprint_id IS NULL
             OR exam_blueprint_id IN (SELECT id FROM exam_blueprints WHERE ${PUBLIC_ROWS}))
      ORDER BY id`,
    skillIds,
  );

  return { items, prerequisites, skills };
}

async function readVocabulary({ organizationId, read }: { organizationId: string; read: Reader }) {
  const words = await read(
    "SELECT * FROM words WHERE organization_id = $1 ORDER BY id",
    organizationId,
  );

  const sentences = await read(
    "SELECT * FROM sentences WHERE organization_id = $1 ORDER BY id",
    organizationId,
  );

  const pronunciations = await read(
    "SELECT * FROM word_pronunciations WHERE word_id = ANY($1::uuid[]) ORDER BY id",
    getRowIds(words),
  );

  return { pronunciations, sentences, words };
}

async function readChildren({
  parent,
  read,
  table,
}: {
  parent: ParentIds;
  read: Reader;
  table: ContentTable;
}): Promise<TableRows> {
  return read(`SELECT * FROM ${table} WHERE ${parent[0]} = ANY($1::uuid[]) ORDER BY id`, parent[1]);
}

/** Rows linking two copied parents, such as a chapter's place in a course. */
async function readLinks({
  parents: [first, second],
  read,
  table,
}: {
  parents: readonly [ParentIds, ParentIds];
  read: Reader;
  table: ContentTable;
}): Promise<TableRows> {
  return read(
    `SELECT * FROM ${table}
      WHERE ${first[0]} = ANY($1::uuid[]) AND ${second[0]} = ANY($2::uuid[])
      ORDER BY ${first[0]}, ${second[0]}`,
    first[1],
    second[1],
  );
}

/**
 * Reads the AI organization's catalog: its courses and every public Library row (chapters, lessons,
 * steps, skills, items and media), with the organization's vocabulary. Public rows are shared by
 * every course and learner, so all of them are read, not only the ones a course reaches: a local
 * learner can point at a quick explanation or a goal's skill that no course outline lists. Seeded
 * rows are left out: each database has its own.
 */
export async function readSourceCatalog({
  organizationId,
  source,
}: {
  organizationId: string;
  source: Client;
}): Promise<SourceCatalog> {
  const read = getReader(source);
  const course = await readCourses({ organizationId, read });
  const skill = await readSkills(read);
  const vocabulary = await readVocabulary({ organizationId, read });
  const media = await read(`SELECT * FROM media_assets WHERE ${CATALOG_ROWS} ORDER BY id`);
  const chapters = await read(`SELECT * FROM library_chapters WHERE ${CATALOG_ROWS} ORDER BY id`);
  const lessons = await read(`SELECT * FROM library_lessons WHERE ${CATALOG_ROWS} ORDER BY id`);

  const courseIds: ParentIds = ["course_id", getRowIds(course.courses)];
  const chapterIds: ParentIds = ["chapter_id", getRowIds(chapters)];
  const lessonIds: ParentIds = ["lesson_id", getRowIds(lessons)];
  const skillIds: ParentIds = ["skill_id", getRowIds(skill.skills)];

  const steps = await readChildren({ parent: lessonIds, read, table: "library_steps" });
  const stepIds: ParentIds = ["step_id", getRowIds(steps)];

  const explanations = await read(
    `SELECT * FROM answer_explanations
      WHERE step_id = ANY($1::uuid[]) OR item_id = ANY($2::uuid[])
      ORDER BY id`,
    stepIds[1],
    getRowIds(skill.items),
  );

  return {
    answer_explanations: explanations,
    chapter_lessons: await readLinks({
      parents: [chapterIds, lessonIds],
      read,
      table: "chapter_lessons",
    }),
    chapter_skills: await readLinks({
      parents: [chapterIds, skillIds],
      read,
      table: "chapter_skills",
    }),
    conversation_scenarios: await readChildren({
      parent: chapterIds,
      read,
      table: "conversation_scenarios",
    }),
    course_categories: course.categories,
    course_chapters: await readLinks({
      parents: [courseIds, chapterIds],
      read,
      table: "course_chapters",
    }),
    course_families: course.families,
    courses: course.courses,
    items: skill.items,
    lesson_sentences: await readLinks({
      parents: [lessonIds, ["sentence_id", getRowIds(vocabulary.sentences)]],
      read,
      table: "lesson_sentences",
    }),
    lesson_skills: await readLinks({
      parents: [lessonIds, skillIds],
      read,
      table: "lesson_skills",
    }),
    lesson_words: await readLinks({
      parents: [lessonIds, ["word_id", getRowIds(vocabulary.words)]],
      read,
      table: "lesson_words",
    }),
    library_chapters: chapters,
    library_lessons: lessons,
    library_steps: steps,
    media_assets: media,
    sentences: vocabulary.sentences,
    skill_prerequisites: skill.prerequisites,
    skills: skill.skills,
    step_variants: await readChildren({ parent: stepIds, read, table: "step_variants" }),
    word_pronunciations: vocabulary.pronunciations,
    words: vocabulary.words,
  };
}
