import "server-only";
import { prisma } from "@zoonk/db";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { cache } from "react";

const cachedGetSentenceWords = cache(async (lessonId: number) => {
  const lessonSentences = await prisma.lessonSentence.findMany({
    include: { sentence: true },
    where: { lessonId },
  });

  if (lessonSentences.length === 0) {
    return [];
  }

  const sentences = lessonSentences.map((ls) => ls.sentence.sentence);
  const uniqueWords = extractUniqueSentenceWords(sentences);

  if (uniqueWords.length === 0) {
    return [];
  }

  return prisma.lessonWord.findMany({
    include: { word: { include: { pronunciations: true } } },
    where: {
      lessonId,
      word: { word: { in: uniqueWords, mode: "insensitive" } },
    },
  });
});

/**
 * Returns `LessonWord` records whose surface form appears in any of the
 * lesson's sentences. The save workflow creates `LessonWord` records for
 * every word that appears in a sentence, so we can query `LessonWord`
 * directly (filtered by surface form match) instead of querying the
 * Word table with text matching. This keeps the return type consistent
 * with getLessonWords, which prepareActivityData also consumes.
 */
export function getSentenceWords(params: { lessonId: number }) {
  return cachedGetSentenceWords(params.lessonId);
}
