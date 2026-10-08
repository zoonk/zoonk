import "server-only";
import { type LanguageLessonParams } from "@zoonk/ai/tasks/v2/language/language-lesson";
import { prisma } from "@zoonk/db";
import { CEFR_BANDS } from "../../../language/levels/skill-level-rules";

/** Enough earlier words to reuse in sentences without crowding the prompt. */
const MAX_KNOWN_WORDS = 80;

type LanguageLessonInputs = {
  learnerLanguage: string;
  /** The Library skill the lesson's screens practice, so answers update its memory. */
  skillId: string | null;
  targetLanguage: string;
  writerInput: Omit<LanguageLessonParams, "analytics" | "model" | "reasoning" | "useFallback">;
};

type LanguageLessonState =
  | { status: "notClaimed" }
  | { status: "notLanguageLesson" }
  | { inputs: LanguageLessonInputs; status: "ready" };

/**
 * Words the learner met in the lessons before this one in its unit, so the
 * writer reuses them instead of teaching them twice.
 */
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

  /** A lesson not placed in its unit yet comes after every lesson already there. */
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

/**
 * Loads what writing a language lesson needs, after confirming this workflow
 * run holds the lesson's content claim: the language pair, the unit's
 * situation and can-dos, the lesson's own can-do, the CEFR band and the words
 * taught before it in the unit.
 */
export async function loadLanguageLessonInputs({
  lessonId,
  workflowRunId,
}: {
  lessonId: string;
  workflowRunId: string;
}): Promise<LanguageLessonState> {
  const lesson = await prisma.lesson.findUnique({
    include: { homeChapter: true, skills: { orderBy: { createdAt: "asc" }, take: 1 } },
    omit: { spec: true, summary: true },
    where: { id: lessonId },
  });

  if (lesson?.contentStatus !== "running" || lesson.contentRunId !== workflowRunId) {
    return { status: "notClaimed" };
  }

  if (!lesson.targetLanguage) {
    return { status: "notLanguageLesson" };
  }

  const unit = lesson.homeChapter;
  const knownWords = await findKnownWords({ chapterId: unit?.id ?? null, lessonId });

  return {
    inputs: {
      learnerLanguage: lesson.language,
      skillId: lesson.skills[0]?.skillId ?? null,
      targetLanguage: lesson.targetLanguage,
      writerInput: {
        knownWords,
        learnerLanguage: lesson.language,
        lessonCanDo: lesson.canDo,
        lessonDescription: lesson.description,
        lessonTitle: lesson.title,
        level: CEFR_BANDS[lesson.level],
        targetLanguage: lesson.targetLanguage,
        unitCanDos: unit?.objectives ?? [],
        unitTitle: unit?.title ?? lesson.title,
      },
    },
    status: "ready",
  };
}
