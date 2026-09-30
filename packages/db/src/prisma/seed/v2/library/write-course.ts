import { buildChapterIdentityKey, buildLessonIdentityKey } from "@zoonk/utils/identity-key";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { type CourseLevel, Prisma, type PrismaClient } from "../../../../generated/prisma/client";
import { type SeedLanguage, localizeObject } from "../_utils/localize";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { seedId } from "../_utils/seed-id";
import { buildLessonSpec } from "./lesson-spec";
import { libraryIds } from "./library-ids";
import { type SeedChapter, type SeedCourse, type SeedLesson } from "./types";
import { writeItems, writeSkills, writeVocabulary } from "./write-skills";

const SEEDED_COURSES_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

type CourseContext = {
  course: SeedCourse;
  courseId: string;
  language: SeedLanguage;
  prisma: PrismaClient;
  sentenceIds: ReadonlyMap<string, string>;
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

/** The summary card is the lesson's `summary` step, stored on the lesson for Content and SEO. */
function lessonSummary(lesson: SeedLesson, language: SeedLanguage) {
  const summary = lesson.steps?.find((step) => step.kind === "summary");
  return summary ? localizeObject(summary.content, language) : Prisma.DbNull;
}

async function writeSteps(context: CourseContext, lesson: SeedLesson, lessonId: string) {
  const { course, language, prisma, sentenceIds, wordIds } = context;
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
        skillId: skillKey ? libraryIds.skill(course.key, skillKey, language) : null,
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
  const skillIds = lesson.skills.map((skill) => libraryIds.skill(course.key, skill, language));
  const isWritten = Boolean(lesson.steps?.length);
  const targetLanguage = targetLanguageOf(course);

  const spec =
    isWritten && course.format !== "language"
      ? buildLessonSpec({ language, lesson, skills: course.skills })
      : Prisma.DbNull;

  const data = {
    canDo: lesson.canDo?.in(language) ?? null,
    contentStatus: isWritten ? ("completed" as const) : ("pending" as const),
    description: lesson.description.in(language),
    estimatedMinutes: lesson.minutes,
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
    spec,
    specStatus: isWritten ? ("completed" as const) : ("pending" as const),
    summary: lessonSummary(lesson, language),
    targetLanguage,
    title,
    ...SEED_PROVENANCE,
  };

  await prisma.lesson.upsert({ create: { id, ...data }, update: data, where: { id } });

  await Promise.all(
    skillIds.map((skillId) =>
      prisma.lessonSkill.upsert({
        create: { lessonId: id, skillId },
        update: {},
        where: { lessonId_skillId: { lessonId: id, skillId } },
      }),
    ),
  );

  await writeSteps(context, lesson, id);

  if (lesson.words || lesson.sentences) {
    await writeLessonVocabulary(context, lesson, id);
  }

  return id;
}

async function writeChapter(context: CourseContext, chapter: SeedChapter, position: number) {
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

  await prisma.courseChapter.upsert({
    create: { chapterId: id, courseId, level: chapter.level, position },
    update: { level: chapter.level, position },
    where: { courseId_chapterId: { chapterId: id, courseId } },
  });

  await Promise.all(
    chapter.lessons.map(async (lesson, lessonPosition) => {
      const lessonId = await writeLesson(context, {
        homeChapterId: id,
        lesson,
        level: chapter.level,
      });

      await prisma.chapterLesson.upsert({
        create: { chapterId: id, lessonId, position: lessonPosition },
        update: { position: lessonPosition },
        where: { chapterId_lessonId: { chapterId: id, lessonId } },
      });
    }),
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

/** Positions restart in each level band, which is how a course places its chapters. */
function bandPosition(course: SeedCourse, chapter: SeedChapter): number {
  return course.chapters
    .filter((item) => item.level === chapter.level)
    .findIndex((item) => item.key === chapter.key);
}

/**
 * Writes one Library course in every language it has: skills and their graph, the outline of
 * chapters and lessons in level bands, the written lessons' steps, summaries and specs, and the
 * question bank. Rows are upserted by stable ids, so running it again only brings content up to date.
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

      await writeSkills(base);

      const [courseId, vocabulary] = await Promise.all([
        writeCourseRow({ ...base, organizationId }),
        writeVocabulary({ ...base, organizationId }),
      ]);

      const context: CourseContext = { ...base, courseId, ...vocabulary };

      await Promise.all([
        ...course.chapters.map((chapter) =>
          writeChapter(context, chapter, bandPosition(course, chapter)),
        ),
        ...(course.explanations ?? []).map((lesson) =>
          writeLesson(context, { homeChapterId: null, lesson, level: "overview" }),
        ),
      ]);

      await writeItems(base);
    }),
  );
}
