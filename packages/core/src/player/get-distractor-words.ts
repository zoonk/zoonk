import { shuffle } from "@zoonk/utils/shuffle";

type DistractorWord = {
  alternativeTranslations: string[];
  id: string;
  translation: string;
};

function isSemanticMatch(correctWord: DistractorWord, candidate: DistractorWord): boolean {
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
 * Excludes semantically equivalent words (same translation, alternative translations)
 * and returns a shuffled subset of the requested count.
 */
export function getDistractorWords<T extends DistractorWord>(
  correctWord: T,
  lessonWords: T[],
  count: number,
): T[] {
  const validDistractors = lessonWords.filter(
    (word) => word.id !== correctWord.id && !isSemanticMatch(correctWord, word),
  );

  return shuffle(validDistractors).slice(0, count);
}
