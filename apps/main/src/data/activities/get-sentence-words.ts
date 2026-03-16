import "server-only";
import { type Word, prisma } from "@zoonk/db";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { cache } from "react";

const cachedGetSentenceWords = cache(async (lessonId: number): Promise<Word[]> => {
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

  const firstSentence = lessonSentences[0]?.sentence;

  if (!firstSentence) {
    return [];
  }

  const { organizationId, targetLanguage, userLanguage } = firstSentence;

  return prisma.word.findMany({
    where: {
      organizationId,
      targetLanguage,
      userLanguage,
      word: { in: uniqueWords },
    },
  });
});

export function getSentenceWords(params: { lessonId: number }): Promise<Word[]> {
  return cachedGetSentenceWords(params.lessonId);
}
