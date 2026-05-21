import "server-only";
import { prisma } from "@zoonk/db";
import { deduplicateNormalizedTexts } from "@zoonk/utils/string";
import { getChapterSentencesForIds } from "./get-chapter-sentences";
import { getChapterWordsForIds } from "./get-chapter-words";

/**
 * Target-language distractors are stored on chapter resources. Loading them by
 * exact resource IDs lets review and derived lessons render the same word bank
 * that generation saved for the source step.
 */
export async function getChapterDistractorWords({
  chapterSentenceIds,
  chapterWordIds,
}: {
  chapterSentenceIds: string[];
  chapterWordIds: string[];
}) {
  const [chapterWords, chapterSentences] = await Promise.all([
    getChapterWordsForIds({ chapterWordIds }),
    getChapterSentencesForIds({ chapterSentenceIds }),
  ]);

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
