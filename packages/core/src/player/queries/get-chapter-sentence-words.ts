import "server-only";
import { prisma } from "@zoonk/db";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { type PlayerChapterSentence } from "./get-chapter-sentences";

/**
 * Derives a sentence word bank from rows the caller already loaded. The player
 * bundles sentence resources at the app boundary, so accepting those rows
 * prevents a second database read while preserving the standalone ID helper.
 */
export async function getChapterSentenceWords(chapterSentences: PlayerChapterSentence[]) {
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

  const { userLanguage } = firstSentence;

  return prisma.chapterWord.findMany({
    include: { word: { include: { pronunciations: { where: { userLanguage } } } } },
    where: {
      sourceLessonId: { in: sourceLessonIds },
      userLanguage,
      word: { word: { in: uniqueWords, mode: "insensitive" } },
    },
  });
}
