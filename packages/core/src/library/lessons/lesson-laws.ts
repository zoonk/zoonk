import "server-only";
import { prisma } from "@zoonk/db";
import { isChallengeIdentityKey } from "../challenges/challenge-lesson-spec";
import { SOURCED_PLAN_KEY } from "../curriculum/save-lesson-specs";
import { hasLessonMaterial } from "../sources/goal-material";
import { selectLawArticles, toLawPages } from "../sources/law-pages";

export type LessonLawsPrompt = {
  chapterTitle: string;
  courseTitle: string;
  isPrivate: boolean;
  language: string;
  lessonCanDo?: string;
  lessonDescription: string;
  lessonTitle: string;
  skills: string[];
};

export type LessonLawsInput = { ownerId: string | null; prompt: LessonLawsPrompt };

/** A law found for the lesson, with the articles it named and its terms in the law's language. */
export type FoundLessonLaw = { articles: string[]; searchTerms: string[]; sourceId: string };

async function findLessonToCheck(lessonId: string) {
  return prisma.lesson.findUnique({
    include: {
      _count: { select: { sources: true } },
      homeChapter: { include: { homeCourse: { select: { productId: true, title: true } } } },
      skills: {
        include: { skill: { select: { name: true } } },
        orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
      },
    },
    omit: { heldBackDrafts: true, spec: true, stagedSummary: true, summary: true },
    where: { id: lessonId },
  });
}

type LessonToCheck = NonNullable<Awaited<ReturnType<typeof findLessonToCheck>>>;

/** Language, challenge and product lessons, and lessons from a learner's own material, cite no law. */
function teachesNoLaw(lesson: LessonToCheck): boolean {
  return (
    lesson.targetLanguage !== null ||
    isChallengeIdentityKey(lesson.identityKey) ||
    Boolean(lesson.homeChapter?.homeCourse?.productId)
  );
}

/**
 * Internal workflow bridge: the lesson must come from the workflow holding its claim. Null for a
 * lesson that never reads laws or already has its laws.
 */
export async function loadLessonLawsInput(lessonId: string): Promise<LessonLawsInput | null> {
  const lesson = await findLessonToCheck(lessonId);

  if (!lesson || lesson._count.sources > 0 || teachesNoLaw(lesson)) {
    return null;
  }

  if (await hasLessonMaterial(lessonId)) {
    return null;
  }

  const chapter = lesson.homeChapter;

  return {
    ownerId: lesson.ownerId,
    prompt: {
      chapterTitle: chapter?.title ?? lesson.title,
      courseTitle: chapter?.homeCourse?.title ?? chapter?.title ?? lesson.title,
      isPrivate: lesson.visibility === "private",
      language: lesson.language,
      lessonCanDo: lesson.canDo ?? undefined,
      lessonDescription: lesson.description,
      lessonTitle: lesson.title,
      skills: lesson.skills.map((entry) => entry.skill.name),
    },
  };
}

function toLessonQuery(prompt: LessonLawsPrompt): string {
  return [prompt.lessonTitle, prompt.lessonDescription, prompt.lessonCanDo, ...prompt.skills]
    .filter(Boolean)
    .join(" ");
}

/**
 * Internal workflow bridge: the lesson must come from the workflow holding its claim. Picks the
 * articles the lesson reads once, so every model that plans, writes, reviews or fixes it reads the
 * same ones.
 */
export async function linkLessonLaws({
  laws,
  lessonId,
  prompt,
}: {
  laws: readonly FoundLessonLaw[];
  lessonId: string;
  prompt: LessonLawsPrompt;
}): Promise<void> {
  const sources = await prisma.source.findMany({
    select: { contentHash: true, extractedText: true, id: true, mimeType: true, title: true },
    where: { extractedText: { not: null }, id: { in: laws.map((law) => law.sourceId) } },
  });

  const texts = laws.flatMap((law, index) => {
    const source = sources.find((candidate) => candidate.id === law.sourceId);
    const named = laws.findIndex((other) => other.sourceId === law.sourceId) === index;

    return named && source?.extractedText
      ? [{ law, source: { ...source, text: source.extractedText } }]
      : [];
  });

  const articles = selectLawArticles({
    laws: texts.map(({ law, source }, index) => ({
      hints: law.articles,
      pages: toLawPages({ index, source }),
      terms: law.searchTerms,
    })),
    query: toLessonQuery(prompt),
  });

  await prisma.lessonSource.createMany({
    data: texts.map(({ source }, index) => ({
      articles: articles[index] ?? [],
      lessonId,
      sourceId: source.id,
    })),
    skipDuplicates: true,
  });
}

/**
 * Internal workflow bridge: a plan saved before plans named provisions only from official text can
 * hold provision numbers from memory, so when the lesson's laws can't be read it's planned again,
 * once, before anything is written from it. True when it will be.
 */
export async function replanUnsourcedLesson(lessonId: string): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE library_lessons AS lesson
    SET spec_status = 'pending', spec_run_id = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE lesson.id = ${lessonId}::uuid
      AND lesson.spec_status = 'completed'
      AND jsonb_typeof(lesson.spec) = 'object'
      AND NOT (lesson.spec ? ${SOURCED_PLAN_KEY})
      AND NOT EXISTS (SELECT 1 FROM library_steps AS step WHERE step.lesson_id = lesson.id)`;

  return updated > 0;
}
