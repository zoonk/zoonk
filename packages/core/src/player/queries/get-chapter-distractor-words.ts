import "server-only";
import { prisma } from "@zoonk/db";
import { deduplicateNormalizedTexts } from "@zoonk/utils/string";
import { type PlayerChapterSentence } from "./get-chapter-sentences";
import { type PlayerChapterWord } from "./get-chapter-words";

/**
 * Resolves distractors from chapter resources the caller already loaded. This
 * lets app-level player bundles reuse their base rows instead of querying the
 * same word and sentence IDs again for each derived resource bank.
 */
export async function getChapterDistractorWordsForResources({
  chapterSentences,
  chapterWords,
}: {
  chapterSentences: PlayerChapterSentence[];
  chapterWords: PlayerChapterWord[];
}) {
  const chapterWord = chapterWords[0];
  const chapterSentence = chapterSentences[0];

  const targetLanguage =
    chapterWord?.word.targetLanguage ?? chapterSentence?.sentence.targetLanguage ?? "";

  const organizationId =
    chapterWord?.word.organizationId ?? chapterSentence?.sentence.organizationId;

  const userLanguage = chapterWord?.userLanguage ?? chapterSentence?.userLanguage ?? "";

  if (!organizationId || !targetLanguage || !userLanguage) {
    return [];
  }

  const distractorTexts = deduplicateNormalizedTexts([
    ...chapterWords.flatMap((entry) => entry.distractors),
    ...chapterSentences.flatMap((entry) => entry.distractors),
  ]);

  if (distractorTexts.length === 0) {
    return [];
  }

  return prisma.word.findMany({
    include: { pronunciations: { where: { userLanguage } } },
    where: { organizationId, targetLanguage, word: { in: distractorTexts, mode: "insensitive" } },
  });
}
