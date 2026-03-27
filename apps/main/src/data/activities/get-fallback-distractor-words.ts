import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";
import { getLessonSentences } from "./get-lesson-sentences";
import { getLessonWords } from "./get-lesson-words";

const FALLBACK_DISTRACTOR_WORD_LIMIT = 4;

type LanguageScope = {
  organizationId: number;
  userLanguage: string;
  targetLanguage: string;
};

/**
 * Derives the language scope from the lesson's own words or sentences so
 * fallback distractors come from the same organization and language pair.
 * `LessonWord` carries `userLanguage` directly; for the word's `targetLanguage`
 * and `organizationId` we look at the included word relation. `LessonSentence`
 * carries the same via its sentence relation.
 */
function getFallbackWordScope(
  lessonWords: Awaited<ReturnType<typeof getLessonWords>>,
  lessonSentences: Awaited<ReturnType<typeof getLessonSentences>>,
): LanguageScope | null {
  const firstWord = lessonWords[0];

  if (firstWord) {
    return {
      organizationId: firstWord.word.organizationId,
      targetLanguage: firstWord.word.targetLanguage,
      userLanguage: firstWord.userLanguage,
    };
  }

  const firstSentence = lessonSentences[0];

  if (firstSentence) {
    return {
      organizationId: firstSentence.sentence.organizationId,
      targetLanguage: firstSentence.sentence.targetLanguage,
      userLanguage: firstSentence.userLanguage,
    };
  }

  return null;
}

const cachedGetFallbackDistractorWords = cache(async (lessonId: number, limit: number) => {
  const [lessonWords, lessonSentences] = await Promise.all([
    getLessonWords({ lessonId }),
    getLessonSentences({ lessonId }),
  ]);

  const scope = getFallbackWordScope(lessonWords, lessonSentences);

  if (!scope) {
    return [];
  }

  const excludedWordIds = lessonWords.map((lw) => lw.wordId);

  return prisma.lessonWord.findMany({
    include: {
      word: {
        include: {
          pronunciations: { where: { userLanguage: scope.userLanguage } },
        },
      },
    },
    orderBy: { id: "desc" },
    take: limit,
    where: {
      lessonId: { not: lessonId },
      userLanguage: scope.userLanguage,
      word: {
        id: { notIn: excludedWordIds },
        organizationId: scope.organizationId,
        targetLanguage: scope.targetLanguage,
      },
    },
  });
});

/**
 * Fetches fallback distractor words from other lessons in the same
 * language context. These fill rare underflow cases when the current
 * lesson doesn't have enough words for the distractor pool.
 * We query `LessonWord` (not `Word`) so distractors come with their
 * lesson-specific translations already attached.
 */
export function getFallbackDistractorWords(params: { lessonId: number; limit?: number }) {
  return cachedGetFallbackDistractorWords(
    params.lessonId,
    params.limit ?? FALLBACK_DISTRACTOR_WORD_LIMIT,
  );
}
