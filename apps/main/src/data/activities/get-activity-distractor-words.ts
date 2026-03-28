import "server-only";
import { prisma } from "@zoonk/db";
import { deduplicateNormalizedTexts } from "@zoonk/utils/string";
import { cache } from "react";
import { getLessonSentences } from "./get-lesson-sentences";
import { getLessonWords } from "./get-lesson-words";

const cachedGetActivityDistractorWords = cache(async (lessonId: number) => {
  const [lessonWords, lessonSentences] = await Promise.all([
    getLessonWords({ lessonId }),
    getLessonSentences({ lessonId }),
  ]);

  const lessonWord = lessonWords[0];
  const lessonSentence = lessonSentences[0];
  const organizationId = lessonWord?.word.organizationId ?? lessonSentence?.sentence.organizationId;
  const targetLanguage =
    lessonWord?.word.targetLanguage ?? lessonSentence?.sentence.targetLanguage ?? "";
  const userLanguage = lessonWord?.userLanguage ?? lessonSentence?.userLanguage ?? "";

  if (!organizationId || !targetLanguage || !userLanguage) {
    return [];
  }

  const distractorTexts = deduplicateNormalizedTexts([
    ...lessonWords.flatMap((entry) => entry.distractors),
    ...lessonSentences.flatMap((entry) => entry.distractors),
  ]);

  if (distractorTexts.length === 0) {
    return [];
  }

  return prisma.word.findMany({
    include: {
      pronunciations: {
        where: { userLanguage },
      },
    },
    where: {
      organizationId,
      targetLanguage,
      word: { in: distractorTexts, mode: "insensitive" },
    },
  });
});

/**
 * Target-language distractors are stored as lesson-scoped strings, but the player also
 * needs reusable `Word` metadata such as audio, romanization, and pronunciation. This
 * query resolves every stored target-language distractor string for one lesson into the
 * matching `Word` records for that lesson's language pair. Listening-side
 * `translationDistractors` are intentionally ignored because they stay plain strings.
 */
export function getActivityDistractorWords(params: { lessonId: number }) {
  return cachedGetActivityDistractorWords(params.lessonId);
}
