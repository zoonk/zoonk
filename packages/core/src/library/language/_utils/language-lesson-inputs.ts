import "server-only";
import { type LanguageLessonParams } from "@zoonk/ai/tasks/language/language-lesson";
import { prisma } from "@zoonk/db";
import { formatLevels } from "../../../language/levels/skill-level-rules";

const MAX_KNOWN_WORDS = 80;

export type LanguageLessonInputs = {
  learnerLanguage: string;
  skillId: string | null;
  targetLanguage: string;
  writerInput: Omit<LanguageLessonParams, "analytics" | "model" | "reasoning" | "useFallback">;
};

type LanguageLessonState =
  | { status: "notClaimed" }
  | { status: "notLanguageLesson" }
  | { inputs: LanguageLessonInputs; status: "ready" };

async function findKnownWords({
  chapterId,
  lessonId,
}: {
  chapterId: string | null;
  lessonId: string;
}): Promise<string[]> {
  if (!chapterId) {
    return [];
  }

  const placement = await prisma.chapterLesson.findUnique({
    where: { chapterId_lessonId: { chapterId, lessonId } },
  });

  const before = placement ? { position: { lt: placement.position } } : {};

  const words = await prisma.lessonWord.findMany({
    include: { word: { select: { word: true } } },
    orderBy: [{ lesson: { createdAt: "asc" } }, { position: "asc" }],
    take: MAX_KNOWN_WORDS,
    where: {
      lesson: { chapters: { some: { chapterId, ...before } } },
      lessonId: { not: lessonId },
    },
  });

  return [...new Set(words.map((row) => row.word.word))];
}

async function findLesson(lessonId: string) {
  return prisma.lesson.findUnique({
    include: {
      homeChapter: {
        include: { goalSkills: { select: { skill: { select: { cefrLevel: true } } } } },
      },
      skills: {
        include: { skill: { select: { cefrLevel: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    omit: { spec: true, summary: true },
    where: { id: lessonId },
  });
}

async function toInputs(
  lesson: NonNullable<Awaited<ReturnType<typeof findLesson>>> & { targetLanguage: string },
): Promise<LanguageLessonInputs> {
  const unit = lesson.homeChapter;
  const knownWords = await findKnownWords({ chapterId: unit?.id ?? null, lessonId: lesson.id });

  // Finer skills have no level, so a lesson linked only to them takes its unit's plan skills' levels.
  const lessonLevels = lesson.skills.flatMap(({ skill }) => skill.cefrLevel ?? []);

  const levels =
    lessonLevels.length > 0
      ? lessonLevels
      : (unit?.goalSkills ?? []).flatMap(({ skill }) => skill.cefrLevel ?? []);

  return {
    learnerLanguage: lesson.language,
    skillId: lesson.skills[0]?.skillId ?? null,
    targetLanguage: lesson.targetLanguage,
    writerInput: {
      knownWords,
      learnerLanguage: lesson.language,
      lessonCanDo: lesson.canDo,
      lessonDescription: lesson.description,
      lessonTitle: lesson.title,
      level: formatLevels({ band: lesson.level, levels }),
      targetLanguage: lesson.targetLanguage,
      unitCanDos: unit?.objectives ?? [],
      unitTitle: unit?.title ?? lesson.title,
    },
  };
}

/** Internal: the calling workflow must hold the lesson's content claim. */
export async function loadLanguageLessonInputs({
  lessonId,
  workflowRunId,
}: {
  lessonId: string;
  workflowRunId: string;
}): Promise<LanguageLessonState> {
  const lesson = await findLesson(lessonId);

  if (lesson?.contentStatus !== "running" || lesson.contentRunId !== workflowRunId) {
    return { status: "notClaimed" };
  }

  if (!lesson.targetLanguage) {
    return { status: "notLanguageLesson" };
  }

  return {
    inputs: await toInputs({ ...lesson, targetLanguage: lesson.targetLanguage }),
    status: "ready",
  };
}

/** What the writer was given for a written language lesson, or null for any other lesson. */
export async function readLanguageLessonInputs(
  lessonId: string,
): Promise<LanguageLessonInputs | null> {
  const lesson = await findLesson(lessonId);

  return lesson?.targetLanguage
    ? toInputs({ ...lesson, targetLanguage: lesson.targetLanguage })
    : null;
}
