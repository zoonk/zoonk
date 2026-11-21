import { normalizeDistractorKey } from "@zoonk/utils/distractors";

type LessonWordText = { translation: string; word: string };

/** Language can't be told from a short word, so this refuses the usual slip: a lesson translation. */
export function wordDistractorProblem({
  distractors,
  words,
}: {
  distractors: readonly string[];
  words: readonly LessonWordText[];
}): string | null {
  const lessonWords = new Set(words.map(({ word }) => normalizeDistractorKey(word)));
  const translations = new Set(words.map(({ translation }) => normalizeDistractorKey(translation)));

  const learnerWords = distractors.filter((distractor) => {
    const key = normalizeDistractorKey(distractor);
    return translations.has(key) && !lessonWords.has(key);
  });

  if (learnerWords.length === 0) {
    return null;
  }

  return `${learnerWords.map((text) => `"${text}"`).join(", ")} ${learnerWords.length === 1 ? "is a translation" : "are translations"} in the learner's language. Use words in the word's own language that a learner could confuse with it.`;
}
