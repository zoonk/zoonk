import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";
import { getLessonSentences } from "./get-lesson-sentences";
import { getLessonWords } from "./get-lesson-words";

const FALLBACK_DISTRACTOR_WORD_LIMIT = 4;

type LanguageScope = {
  organizationId: number;
  targetLanguage: string;
};

/**
 * We fetch fallback distractors from the same language context as the lesson so
 * the player can fill rare underflow cases without building a larger scope system.
 */
function getFallbackWordScope(
  lessonWords: LanguageScope[],
  lessonSentences: LanguageScope[],
): LanguageScope | null {
  return lessonWords[0] ?? lessonSentences[0] ?? null;
}

/**
 * Fallback distractors depend on lesson words for excluded ids and on lesson
 * sentences for a sentence-only language scope, so this helper runs the whole
 * lookup in one cached function. That keeps the API small and makes the cache
 * key match the only public inputs: lesson id and limit.
 */
const cachedGetFallbackDistractorWords = cache(async (lessonId: number, limit: number) => {
  const [lessonWords, lessonSentences] = await Promise.all([
    getLessonWords({ lessonId }),
    getLessonSentences({ lessonId }),
  ]);

  const scope = getFallbackWordScope(lessonWords, lessonSentences);

  if (!scope) {
    return [];
  }

  return prisma.word.findMany({
    include: { translations: true },
    orderBy: { id: "desc" },
    take: limit,
    where: {
      id: { notIn: lessonWords.map((word) => word.id) },
      organizationId: scope.organizationId,
      targetLanguage: scope.targetLanguage,
    },
  });
});

export function getFallbackDistractorWords(params: { lessonId: number; limit?: number }) {
  return cachedGetFallbackDistractorWords(
    params.lessonId,
    params.limit ?? FALLBACK_DISTRACTOR_WORD_LIMIT,
  );
}
