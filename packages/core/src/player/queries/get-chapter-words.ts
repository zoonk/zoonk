import "server-only";
import { type ChapterWordGetPayload, prisma } from "@zoonk/db";

export type PlayerChapterWord = ChapterWordGetPayload<{
  include: { word: { include: { pronunciations: true } } };
}>;

/**
 * Player steps point at exact chapter-word resources. Loading by those IDs
 * keeps derived translation and review lessons tied to the generated
 * translation and distractor row instead of guessing from lesson kind/order.
 */
export async function getChapterWordsForIds(
  chapterWordIds: string[],
): Promise<PlayerChapterWord[]> {
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
}
