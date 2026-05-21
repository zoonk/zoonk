import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

/**
 * Player steps point at exact chapter-word resources. Loading by those IDs
 * keeps derived translation and review lessons tied to the generated
 * translation and distractor row instead of guessing from lesson kind/order.
 */
const cachedGetChapterWordsForIds = cache(async (...chapterWordIds: string[]) => {
  if (chapterWordIds.length === 0) {
    return [];
  }

  const firstChapterWord = await prisma.chapterWord.findFirst({
    where: { id: { in: chapterWordIds } },
  });

  if (!firstChapterWord) {
    return [];
  }

  return prisma.chapterWord.findMany({
    include: {
      word: {
        include: { pronunciations: { where: { userLanguage: firstChapterWord.userLanguage } } },
      },
    },
    where: { id: { in: chapterWordIds } },
  });
});

export function getChapterWordsForIds(params: { chapterWordIds: string[] }) {
  return cachedGetChapterWordsForIds(...params.chapterWordIds);
}
