import "server-only";
import { prisma } from "@zoonk/db";
import { deduplicateNormalizedTexts } from "@zoonk/utils/string";
import { getLessonSentencesForLessons } from "./get-lesson-sentences";
import { getLessonWordsForLessons } from "./get-lesson-words";

/**
 * Target-language distractors are derived from lesson-scoped word and
 * sentence rows. Review lessons pass multiple source lessons so the same
 * derivation still sees the real content that produced each step.
 */
async function listLessonDistractorWordsForLessons({ lessonIds }: { lessonIds: string[] }) {
  const [lessonWords, lessonSentences] = await Promise.all([
    getLessonWordsForLessons({ lessonIds }),
    getLessonSentencesForLessons({ lessonIds }),
  ]);

  const lessonWord = lessonWords[0];
  const lessonSentence = lessonSentences[0];
  const organizationId = lessonWord?.word.organizationId ?? lessonSentence?.sentence.organizationId;
  const targetLanguage =
    lessonWord?.word.targetLanguage ?? lessonSentence?.sentence.targetLanguage ?? "";
  const userLanguage = lessonWord?.userLanguage ?? lessonSentence?.userLanguage ?? "";

  if (!organizationId || !targetLanguage || !userLanguage) {
    return [];
  }

  const distractorTexts = deduplicateNormalizedTexts([
    ...lessonWords.flatMap((entry) => entry.distractors),
    ...lessonSentences.flatMap((entry) => entry.distractors),
  ]);

  if (distractorTexts.length === 0) {
    return [];
  }

  return prisma.word.findMany({
    include: {
      pronunciations: {
        where: { userLanguage },
      },
    },
    where: {
      organizationId,
      targetLanguage,
      word: { in: distractorTexts, mode: "insensitive" },
    },
  });
}

/**
 * Fetches distractor metadata for the source lessons behind a review lesson.
 * The review lesson row itself has no generated vocabulary payload.
 */
export function getLessonDistractorWordsForLessons(params: { lessonIds: string[] }) {
  return listLessonDistractorWordsForLessons({ lessonIds: params.lessonIds });
}
