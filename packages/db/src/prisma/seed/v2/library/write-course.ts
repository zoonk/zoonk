import { buildChapterIdentityKey, buildLessonIdentityKey } from "@zoonk/utils/identity-key";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { type CourseLevel, Prisma, type PrismaClient } from "../../../../generated/prisma/client";
import { type SeedLanguage, localizeObject } from "../_utils/localize";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { seedId } from "../_utils/seed-id";
import { buildLessonSpec } from "./lesson-spec";
import { libraryIds } from "./library-ids";
import { type SeedChapter, type SeedCourse, type SeedLesson } from "./types";
import { type SkillIds, skillIdOf, writeItems, writeSkills, writeVocabulary } from "./write-skills";

const SEEDED_COURSES_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

type CourseContext = {
  course: SeedCourse;
  courseId: string;
  language: SeedLanguage;
  prisma: PrismaClient;
  sentenceIds: ReadonlyMap<string, string>;
  skillIds: SkillIds;
  wordIds: ReadonlyMap<string, string>;
};

function targetLanguageOf(course: SeedCourse): string | null {
  return course.targetLanguage ?? null;
}

function lookup(ids: ReadonlyMap<string, string>, text: string | undefined): string | null {
  if (!text) {
    return null;
  }

  const id = ids.get(text);

  if (!id) {
    throw new Error(`Seed vocabulary is missing "${text}"`);
  }

  return id;
}

/** A row's place in a list the seed orders: a level band of a course's chapters, or a chapter's lessons. */
type Slot = { id: string; position: number };

/**
 * The places to write for the seed's rows in one of its lists. A list holding only seeded rows
 * takes the seed's order. The app adds its own rows to seeded lists and renumbers them (a chapter
 * in teaching order, a split lesson right after the one it came from), so in a list it has touched,
 * the rows already there keep their places and a missing one takes its seeded position, or goes
 * after the last row when another holds that position.
 */
function arrangeSlots(placed: readonly Slot[], seeded: readonly Slot[]): Slot[] {
  const seededIds = new Set(seeded.map((slot) => slot.id));

  if (placed.every((slot) => seededIds.has(slot.id))) {
    return [...seeded];
  }

  const placedIds = new Set(placed.map((slot) => slot.id));
  const taken = new Set(placed.map((slot) => slot.position));
  const missing = seeded.filter((slot) => !placedIds.has(slot.id));
  const free = missing.filter((slot) => !taken.has(slot.position));
  const moved = missing.filter((slot) => taken.has(slot.position));
  const end = Math.max(-1, ...[...placed, ...free].map((slot) => slot.position)) + 1;

  return [...free, ...moved.map((slot, index) => ({ ...slot, position: end + index }))];
}

/** The summary card is the lesson's `summary` step, stored on the lesson for Content and SEO. */
function lessonSummary(lesson: SeedLesson, language: SeedLanguage) {
  const summary = lesson.steps?.find((step) => step.kind === "summary");
  return summary ? localizeObject(summary.content, language) : Prisma.DbNull;
}

async function writeSteps(context: CourseContext, lesson: SeedLesson, lessonId: string) {
  const { course, language, prisma, sentenceIds, skillIds, wordIds } = context;
  const steps = lesson.steps ?? [];

  const ids = await Promise.all(
    steps.map(async (step, position) => {
      const id = libraryIds.step(course.key, lesson.key, position, language);
      const skillKey = step.skill ?? lesson.skills[0];

      const data = {
        content: localizeObject(step.content, language),
        contractVersion: 1,
        kind: step.kind,
        lessonId,
        position,
        sentenceId: lookup(sentenceIds, step.sentence),
        skillId: skillKey ? skillIdOf(course, skillIds, skillKey) : null,
        wordId: lookup(wordIds, step.word),
        ...SEED_PROVENANCE,
      };

      await prisma.step.upsert({ create: { id, ...data }, update: data, where: { id } });

      return id;
    }),
  );

  await prisma.step.deleteMany({ where: { id: { notIn: ids }, lessonId } });
}

/**
 * A language lesson's links to the shared words and sentences it teaches, with this pair's
 * translations, explanations and wrong options. Other pairs keep their own links to the same rows.
 */
async function writeLessonVocabulary(context: CourseContext, lesson: SeedLesson, lessonId: string) {
  const { language, prisma, sentenceIds, wordIds } = context;

  const words = (lesson.words ?? []).map((entry, position) => ({
    distractors: entry.distractors,
    lessonId,
    note: entry.note?.in(language) ?? null,
    position,
    translation: entry.translation.in(language),
    wordId: lookup(wordIds, entry.word) ?? "",
    ...SEED_PROVENANCE,
  }));

  const sentences = (lesson.sentences ?? []).map((entry, position) => ({
    distractors: entry.distractors,
    explanation: entry.explanation.in(language),
    lessonId,
    position,
    sentenceId: lookup(sentenceIds, entry.sentence) ?? "",
    translation: entry.translation.in(language),
    translationDistractors: entry.translationDistractors.map((word) => word.in(language)),
    ...SEED_PROVENANCE,
  }));

  await prisma.$transaction([
    prisma.lessonWord.deleteMany({ where: { lessonId } }),
    prisma.lessonSentence.deleteMany({ where: { lessonId } }),
    prisma.lessonWord.createMany({ data: words }),
    prisma.lessonSentence.createMany({ data: sentences }),
  ]);
}

/**
 * Whether the app has written a seeded lesson: it wrote steps of its own (a learner reached the
 * outline lesson, or it was written again), or it started writing an outline lesson (its spec or
 * content is no longer pending).
 */
async function isWrittenByApp(
  prisma: PrismaClient,
  { id, isWritten }: { id: string; isWritten: boolean },
): Promise<boolean> {
  const existing = await prisma.lesson.findUnique({
    select: {
      contentStatus: true,
      specStatus: true,
      steps: { select: { id: true }, take: 1, where: { runId: { not: SEED_PROVENANCE.runId } } },
    },
    where: { id },
  });

  if (!existing) {
    return false;
  }

  if (existing.steps.length > 0) {
    return true;
  }

  return !isWritten && (existing.specStatus !== "pending" || existing.contentStatus !== "pending");
}

/** A lesson with its skills and steps. Quick explanations have no home chapter and no course. */
async function writeLesson(
  context: CourseContext,
  {
    homeChapterId,
    lesson,
    level,
  }: { homeChapterId: string | null; lesson: SeedLesson; level: CourseLevel },
): Promise<string> {
  const { course, courseId, language, prisma } = context;
  const id = libraryIds.lesson(course.key, lesson.key, language);
  const title = lesson.title.in(language);
  const skillIds = lesson.skills.map((skill) => skillIdOf(course, context.skillIds, skill));
  const isWritten = Boolean(lesson.steps?.length);
  const targetLanguage = targetLanguageOf(course);

  const spec =
    isWritten && course.format !== "language"
      ? buildLessonSpec({ language, lesson, skills: course.skills })
      : Prisma.DbNull;

  const outline = {
    description: lesson.description.in(language),
    homeChapterId,
    identityKey: buildLessonIdentityKey({
      courseId: homeChapterId ? courseId : null,
      level,
      skillIds,
      targetLanguage,
    }),
    language,
    level,
    normalizedTitle: normalizeString(title),
    slug: toSlug(title),
    targetLanguage,
    title,
    ...SEED_PROVENANCE,
  };

  // What a lesson's writing sets: a written lesson's as the seed wrote it, an outline lesson's
  // empty until a learner reaches it and the app writes it.
  const content = {
    canDo: lesson.canDo?.in(language) ?? null,
    contentStatus: isWritten ? ("completed" as const) : ("pending" as const),
    estimatedMinutes: lesson.minutes,
    spec,
    specStatus: isWritten ? ("completed" as const) : ("pending" as const),
    summary: lessonSummary(lesson, language),
  };

  // A reseed never throws away what the app wrote, which would make it pay to write it again: the
  // seed writes a lesson's content only while it's the seed's or still empty.
  const keepsContent = await isWrittenByApp(prisma, { id, isWritten });

  await prisma.lesson.upsert({
    create: { id, ...outline, ...content },
    update: keepsContent ? outline : { ...outline, ...content },
    where: { id },
  });

  await Promise.all(
    skillIds.map((skillId) =>
      prisma.lessonSkill.upsert({
        create: { lessonId: id, skillId },
        update: {},
        where: { lessonId_skillId: { lessonId: id, skillId } },
      }),
    ),
  );

  if (keepsContent) {
    return id;
  }

  await writeSteps(context, lesson, id);

  if (lesson.words || lesson.sentences) {
    await writeLessonVocabulary(context, lesson, id);
  }

  return id;
}

async function writeChapter(context: CourseContext, chapter: SeedChapter) {
  const { course, courseId, language, prisma } = context;
  const id = libraryIds.chapter(course.key, chapter.key, language);
  const title = chapter.title.in(language);
  const targetLanguage = targetLanguageOf(course);

  const data = {
    description: chapter.description.in(language),
    homeCourseId: courseId,
    identityKey: buildChapterIdentityKey({ courseId, level: chapter.level, targetLanguage, title }),
    language,
    level: chapter.level,
    normalizedTitle: normalizeString(title),
    objectives: chapter.objectives.map((objective) => objective.in(language)),
    outlineStatus: "completed" as const,
    slug: toSlug(title),
    targetLanguage,
    title,
    tools: (chapter.tools ?? []).map((tool) => ({ ...tool, name: tool.name.in(language) })),
    ...SEED_PROVENANCE,
  };

  await prisma.chapter.upsert({ create: { id, ...data }, update: data, where: { id } });

  const lessonIds = await Promise.all(
    chapter.lessons.map((lesson) =>
      writeLesson(context, { homeChapterId: id, lesson, level: chapter.level }),
    ),
  );

  const placed = await prisma.chapterLesson.findMany({
    select: { lessonId: true, position: true },
    where: { chapterId: id },
  });

  const slots = arrangeSlots(
    placed.map((row) => ({ id: row.lessonId, position: row.position })),
    lessonIds.map((lessonId, position) => ({ id: lessonId, position })),
  );

  await Promise.all(
    slots.map(({ id: lessonId, position }) =>
      prisma.chapterLesson.upsert({
        create: { chapterId: id, lessonId, position },
        update: { position },
        where: { chapterId_lessonId: { chapterId: id, lessonId } },
      }),
    ),
  );
}

async function writeCourseRow({
  course,
  language,
  organizationId,
  prisma,
}: {
  course: SeedCourse;
  language: SeedLanguage;
  organizationId: string;
  prisma: PrismaClient;
}): Promise<string> {
  const id = libraryIds.course(course.key, language);
  const title = course.title.in(language);

  const data = {
    // An old date keeps seeded courses behind real ones wherever the newest course wins.
    createdAt: SEEDED_COURSES_CREATED_AT,
    description: course.description.in(language),
    familyId: seedId(`family:${course.key}`),
    format: course.format,
    imageUrl: `/catalog/chapters/${course.category}.webp`,
    isPublished: true,
    language,
    normalizedTitle: normalizeString(title),
    organizationId,
    outlineStatus: "completed" as const,
    slug: course.slug.in(language),
    targetLanguage: targetLanguageOf(course),
    title,
    visibility: "public" as const,
  };

  await prisma.course.upsert({ create: { id, ...data }, update: data, where: { id } });

  await prisma.courseCategory.upsert({
    create: { category: course.category, courseId: id },
    update: {},
    where: { courseCategory: { category: course.category, courseId: id } },
  });

  return id;
}

/**
 * Puts the course's chapters in its outline, each level band ordered as the seed lists it (see
 * `arrangeSlots`).
 */
async function writeOutline({ course, courseId, language, prisma }: CourseContext): Promise<void> {
  const placed = await prisma.courseChapter.findMany({
    select: { chapterId: true, level: true, position: true },
    where: { courseId },
  });

  const levels = [...new Set(course.chapters.map((chapter) => chapter.level))];

  const slots = levels.flatMap((level) =>
    arrangeSlots(
      placed
        .filter((row) => row.level === level)
        .map((row) => ({ id: row.chapterId, position: row.position })),
      course.chapters
        .filter((chapter) => chapter.level === level)
        .map((chapter, position) => ({
          id: libraryIds.chapter(course.key, chapter.key, language),
          position,
        })),
    ).map((slot) => ({ ...slot, level })),
  );

  await Promise.all(
    slots.map(({ id: chapterId, level, position }) =>
      prisma.courseChapter.upsert({
        create: { chapterId, courseId, level, position },
        update: { level, position },
        where: { courseId_chapterId: { chapterId, courseId } },
      }),
    ),
  );
}

/**
 * Writes one Library course in every language it has: skills and their graph, the outline of
 * chapters and lessons in level bands, the written lessons' steps, summaries and specs, and the
 * question bank. Rows are upserted by stable ids, so running it again only brings content up to date,
 * and on a database learners have used it keeps the skills and outline places the app wrote.
 */
export async function writeLibraryCourse({
  course,
  organizationId,
  prisma,
}: {
  course: SeedCourse;
  organizationId: string;
  prisma: PrismaClient;
}): Promise<void> {
  const familyId = seedId(`family:${course.key}`);

  // The family is shared by every language, so it goes first and the languages run in parallel.
  await prisma.courseFamily.upsert({
    create: { id: familyId },
    update: {},
    where: { id: familyId },
  });

  await Promise.all(
    course.languages.map(async (language) => {
      const base = { course, language, prisma };

      const skillIds = await writeSkills(base);

      const [courseId, vocabulary] = await Promise.all([
        writeCourseRow({ ...base, organizationId }),
        writeVocabulary({ ...base, organizationId }),
      ]);

      const context: CourseContext = { ...base, courseId, skillIds, ...vocabulary };

      await Promise.all([
        ...course.chapters.map((chapter) => writeChapter(context, chapter)),
        ...(course.explanations ?? []).map((lesson) =>
          writeLesson(context, { homeChapterId: null, lesson, level: "overview" }),
        ),
      ]);

      await writeOutline(context);

      await writeItems({ ...base, skillIds });
    }),
  );
}
