import { shuffle } from "@zoonk/utils/shuffle";

type DistractorWord = {
  alternativeTranslations: string[];
  id: string;
  translation: string;
  word: string;
};

function normalizeWordText(text: string): string {
  return text
    .replaceAll(/[^\p{L}\p{N}\s]/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Vocabulary distractors must stay unambiguous for the learner, so this helper
 * centralizes the rule for when a word is safe to show as a wrong answer.
 */
function isValidDistractor<T extends DistractorWord>(correctWord: T, candidate: T): boolean {
  const correctNormalized = normalizeWordText(correctWord.word);

  return (
    candidate.id !== correctWord.id &&
    !isSemanticMatch(correctWord, candidate) &&
    normalizeWordText(candidate.word) !== correctNormalized
  );
}

/**
 * We deduplicate on normalized word text so punctuation variants such as
 * "ca va." and "ca va?" never consume multiple answer slots.
 */
function getUniqueDistractors<T extends DistractorWord>(
  correctWord: T,
  lessonWords: T[],
  excludedWordKeys = new Set<string>(),
): T[] {
  return [
    ...new Map(
      lessonWords.flatMap((word) => {
        const normalizedWord = normalizeWordText(word.word);

        if (excludedWordKeys.has(normalizedWord) || !isValidDistractor(correctWord, word)) {
          return [];
        }

        return [[normalizedWord, word] as const];
      }),
    ).values(),
  ];
}

export function isSemanticMatch(correctWord: DistractorWord, candidate: DistractorWord): boolean {
  const correctTranslation = correctWord.translation.toLowerCase();
  const candidateTranslation = candidate.translation.toLowerCase();
  const correctAlternatives = correctWord.alternativeTranslations.map((alt) => alt.toLowerCase());
  const candidateAlternatives = new Set(
    candidate.alternativeTranslations.map((alt) => alt.toLowerCase()),
  );

  // Rule 2: same translation
  if (correctTranslation === candidateTranslation) {
    return true;
  }

  // Rule 3: candidate's translation is in the correct word's alternatives
  if (correctAlternatives.includes(candidateTranslation)) {
    return true;
  }

  // Rule 4: correct word's translation is in the candidate's alternatives
  if (candidateAlternatives.has(correctTranslation)) {
    return true;
  }

  // Rule 5: overlapping alternatives (shared synonym means semantic equivalence)
  if (correctAlternatives.some((alt) => candidateAlternatives.has(alt))) {
    return true;
  }

  return false;
}

/**
 * Filters lesson words to produce valid distractors for vocabulary exercises.
 * Excludes semantically equivalent words first from the lesson pool, then uses a
 * small fallback pool only when the lesson does not have enough safe options.
 */
export function getDistractorWords<T extends DistractorWord>(
  correctWord: T,
  lessonWords: T[],
  count: number,
  fallbackWords: T[] = [],
): T[] {
  const lessonDistractors = shuffle(getUniqueDistractors(correctWord, lessonWords)).slice(0, count);

  if (lessonDistractors.length >= count || fallbackWords.length === 0) {
    return lessonDistractors;
  }

  const fallbackDistractors = shuffle(
    getUniqueDistractors(
      correctWord,
      fallbackWords,
      new Set(lessonDistractors.map((word) => normalizeWordText(word.word))),
    ),
  ).slice(0, count - lessonDistractors.length);

  return [...lessonDistractors, ...fallbackDistractors];
}
