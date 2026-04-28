import "server-only";
import { prisma } from "@zoonk/db";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { getLessonSentencesForLessons } from "./get-lesson-sentences";

/**
 * Sentence word banks are derived from the sentence rows attached to the
 * lesson content. Review lessons need this derivation across the source
 * lessons whose steps are being replayed.
 */
async function listSentenceWordsForLessons({ lessonIds }: { lessonIds: string[] }) {
  const lessonSentences = await getLessonSentencesForLessons({ lessonIds });

  const firstSentence = lessonSentences[0];

  if (!firstSentence) {
    return [];
  }

  const sentences = lessonSentences.map((ls) => ls.sentence.sentence);
  const uniqueWords = extractUniqueSentenceWords(sentences);

  if (uniqueWords.length === 0) {
    return [];
  }

  // All LessonSentence records in a lesson share the same userLanguage.
  const { userLanguage } = firstSentence;

  return prisma.lessonWord.findMany({
    include: {
      word: {
        include: { pronunciations: { where: { userLanguage } } },
      },
    },
    where: {
      lessonId: { in: lessonIds },
      word: { word: { in: uniqueWords, mode: "insensitive" } },
    },
  });
}

/**
 * Fetches sentence word-bank metadata for a group of lessons so review steps
 * can reuse the exact words generated for their source lessons.
 */
export function getSentenceWordsForLessons(params: { lessonIds: string[] }) {
  return listSentenceWordsForLessons({ lessonIds: params.lessonIds });
}
