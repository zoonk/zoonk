import "server-only";
import { prisma } from "@zoonk/db";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { getChapterSentencesForIds } from "./get-chapter-sentences";

/**
 * Sentence word banks are derived from the exact chapter-sentence rows attached
 * to the current playable steps. The matching chapter-word rows must come from
 * the same source lessons that introduced those sentences so contextual
 * translations stay aligned.
 */
export async function getChapterSentenceWordsForIds({
  chapterSentenceIds,
}: {
  chapterSentenceIds: string[];
}) {
  const chapterSentences = await getChapterSentencesForIds({ chapterSentenceIds });

  const firstSentence = chapterSentences[0];

  if (!firstSentence) {
    return [];
  }

  const sourceLessonIds = [...new Set(chapterSentences.map((entry) => entry.sourceLessonId))];
  const sentences = chapterSentences.map((entry) => entry.sentence.sentence);
  const uniqueWords = extractUniqueSentenceWords(sentences);

  if (uniqueWords.length === 0) {
    return [];
  }

  // All chapter sentence resources in one player payload share the learner's language.
  const { userLanguage } = firstSentence;

  return prisma.chapterWord.findMany({
    include: { word: { include: { pronunciations: { where: { userLanguage } } } } },
    where: {
      sourceLessonId: { in: sourceLessonIds },
      word: { word: { in: uniqueWords, mode: "insensitive" } },
    },
  });
}
