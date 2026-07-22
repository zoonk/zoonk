import "server-only";
import { type ChapterSentenceGetPayload, prisma } from "@zoonk/db";

export type PlayerChapterSentence = ChapterSentenceGetPayload<{ include: { sentence: true } }>;

/**
 * Player steps point at exact chapter-sentence resources. Loading by those IDs
 * makes listening, reading, and review payloads use the generated translation
 * and distractor row attached to the step.
 */
export async function getChapterSentencesForIds(
  chapterSentenceIds: string[],
): Promise<PlayerChapterSentence[]> {
  if (chapterSentenceIds.length === 0) {
    return [];
  }

  return prisma.chapterSentence.findMany({
    include: { sentence: true },
    where: { id: { in: chapterSentenceIds } },
  });
}
