import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

/**
 * Player steps point at exact chapter-sentence resources. Loading by those IDs
 * makes listening, reading, and review payloads use the generated translation
 * and distractor row attached to the step.
 */
const cachedGetChapterSentencesForIds = cache(async (...chapterSentenceIds: string[]) => {
  if (chapterSentenceIds.length === 0) {
    return [];
  }

  return prisma.chapterSentence.findMany({
    include: { sentence: true },
    where: { id: { in: chapterSentenceIds } },
  });
});

export function getChapterSentencesForIds(params: { chapterSentenceIds: string[] }) {
  return cachedGetChapterSentencesForIds(...params.chapterSentenceIds);
}
