import { normalizeDistractorKey } from "@zoonk/utils/distractors";
import { type ContentFixEffect } from "../contract";

type LessonWordText = { translation: string; word: string };

/** Language can't be told from a short word, so this flags the usual slip for review: a lesson translation. */
export function translationDistractorEffects({
  distractors,
  wordId,
  words,
}: {
  distractors: readonly string[];
  wordId: string;
  words: readonly LessonWordText[];
}): ContentFixEffect[] {
  const lessonWords = new Set(words.map(({ word }) => normalizeDistractorKey(word)));
  const translations = new Set(words.map(({ translation }) => normalizeDistractorKey(translation)));

  const texts = distractors.filter((distractor) => {
    const key = normalizeDistractorKey(distractor);
    return translations.has(key) && !lessonWords.has(key);
  });

  return texts.length > 0 ? [{ kind: "distractorsLikeTranslations", texts, wordId }] : [];
}
