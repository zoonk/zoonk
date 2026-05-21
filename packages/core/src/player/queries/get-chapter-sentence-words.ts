import "server-only";
import { prisma } from "@zoonk/db";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { cache } from "react";
import { getChapterSentencesForIds } from "./get-chapter-sentences";

/**
 * Sentence word banks are derived from the exact chapter-sentence rows attached
 * to the current playable steps. The matching chapter-word rows must come from
 * the same source lessons that introduced those sentences so contextual
 * translations stay aligned.
 */
const cachedGetChapterSentenceWordsForIds = cache(async (...chapterSentenceIds: string[]) => {
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

  const { userLanguage } = firstSentence;

  return prisma.chapterWord.findMany({
    include: { word: { include: { pronunciations: { where: { userLanguage } } } } },
    where: {
      sourceLessonId: { in: sourceLessonIds },
      userLanguage,
      word: { word: { in: uniqueWords, mode: "insensitive" } },
    },
  });
});

export function getChapterSentenceWordsForIds(params: { chapterSentenceIds: string[] }) {
  return cachedGetChapterSentenceWordsForIds(...params.chapterSentenceIds);
}
