import {
  deduplicateNormalizedTexts,
  hasWholePhrase,
  normalizePunctuation,
  normalizeString,
  replaceWholePhrase,
} from "@zoonk/utils/string";

type SentenceWithDistractorUnsafeTexts = {
  distractorUnsafeSentences: string[];
  distractorUnsafeTranslations: string[];
  sentence: string;
  translation: string;
};

/**
 * A word with its translation and distractor-unsafe translations, used to
 * derive sentence-level distractor filtering from vocabulary data.
 *
 * We need this because sentence activities can create misleading word-bank
 * distractors even when the sentence itself is canonical. If two lesson words
 * share the same learner-language translation, we derive extra sentence-level
 * distractor blocks so those overlapping forms never appear as false distractors.
 */
export type VocabularyDistractorUnsafeWord = {
  distractorUnsafeTranslations: string[];
  translation: string;
  word: string;
};

/**
 * The same distractor-unsafe translation can arrive with tiny formatting differences, such as
 * "Bonjour !" vs "Bonjour!". Clean and deduplicate that list once here so the rest
 * of this file compares one stable set of translations.
 */
function getWordTranslations(word: VocabularyDistractorUnsafeWord): string[] {
  return deduplicateNormalizedTexts([word.translation, ...word.distractorUnsafeTranslations]);
}

/**
 * Keep one shared rule for "does this exact expression appear in this text?" so every
 * caller makes the same decision.
 */
function hasPhrase(text: string, phrase: string): boolean {
  return hasWholePhrase(text, phrase);
}

/**
 * Normalize lesson text once before we compare or replace it so every helper in this
 * file treats spacing and punctuation the same way.
 */
function getNormalizedText(text: string): string {
  return normalizePunctuation(text).trim();
}

/**
 * Turn any lesson text into the stable lookup key used throughout this file.
 * Returning null for empty values lets higher-level helpers stay declarative.
 */
function getTextKey(text: string): string | null {
  const normalizedText = getNormalizedText(text);

  if (!normalizedText) {
    return null;
  }

  return normalizeString(normalizedText);
}

/**
 * When we build a new variant, replace only the exact expression we matched above.
 * This avoids changing unrelated text by accident.
 */
function replacePhrase(text: string, search: string, replacement: string): string | null {
  return replaceWholePhrase(text, search, replacement);
}

/**
 * Compare two texts with the same normalization rules used everywhere else in this
 * file so we can treat punctuation-only differences as the same value.
 */
function isSameText(left: string, right: string): boolean {
  const leftKey = getTextKey(left);

  return leftKey !== null && leftKey === getTextKey(right);
}

/**
 * Return one replacement variant when the replacement is meaningfully different and
 * the whole-phrase substitution succeeds. Using an array keeps flatMap pipelines linear.
 */
function getReplacementVariant(text: string, search: string, replacement: string): string[] {
  if (isSameText(search, replacement)) {
    return [];
  }

  const derivedText = replacePhrase(text, search, replacement);

  return derivedText ? [derivedText] : [];
}

/**
 * We can receive distractor-unsafe texts from the AI and from our own lesson-word
 * rules. Merge them into one clean list, remove duplicates like "Bom dia !"
 * vs "Bom dia!", and drop anything that is just a copy of the canonical text.
 */
function mergeDistractorUnsafeTexts(primaryText: string, texts: string[]): string[] {
  const primaryKey = getTextKey(primaryText);

  return deduplicateNormalizedTexts(texts).filter((text) => getTextKey(text) !== primaryKey);
}

/**
 * Add one source-language word to the translation lookup for a translation it can express.
 * Centralizing this mutation keeps the map-building loop focused on data flow.
 */
function addTargetWordForTranslation(
  targetWordsByTranslation: Map<string, string[]>,
  translation: string,
  word: string,
): void {
  const translationKey = getTextKey(translation);

  if (!translationKey) {
    return;
  }

  const currentWords = targetWordsByTranslation.get(translationKey) ?? [];

  targetWordsByTranslation.set(translationKey, deduplicateNormalizedTexts([...currentWords, word]));
}

/**
 * Build a lookup from a translation to every source-language word that can mean the same thing.
 * Example: "Bom dia" can point to both "Guten Morgen" and "Guten Tag".
 * We use that later to create allowed extra sentence variants without repeatedly scanning all words.
 */
function buildTargetWordsByTranslation(
  words: VocabularyDistractorUnsafeWord[],
): Map<string, string[]> {
  const targetWordsByTranslation = new Map<string, string[]>();

  for (const word of words) {
    const normalizedWord = getNormalizedText(word.word);

    for (const translation of getWordTranslations(word)) {
      addTargetWordForTranslation(targetWordsByTranslation, translation, normalizedWord);
    }
  }

  return targetWordsByTranslation;
}

/**
 * Find which distractor-relevant translations from a vocabulary word actually
 * appear in this sentence pair. Both derived-text builders need this same
 * matching step.
 */
function getMatchedTranslationsInSentence(
  sentence: SentenceWithDistractorUnsafeTexts,
  word: VocabularyDistractorUnsafeWord,
): string[] {
  if (!hasPhrase(sentence.sentence, word.word)) {
    return [];
  }

  return getWordTranslations(word).filter((translation) =>
    hasPhrase(sentence.translation, translation),
  );
}

/**
 * Resolve a matched translation into the equivalent source-language words that lesson data
 * says can express it.
 */
function getEquivalentWordsForTranslation(
  translation: string,
  targetWordsByTranslation: Map<string, string[]>,
): string[] {
  const translationKey = getTextKey(translation);

  if (!translationKey) {
    return [];
  }

  return targetWordsByTranslation.get(translationKey) ?? [];
}

/**
 * Generate all extra source-language variants contributed by one matched vocabulary word.
 * Splitting this out keeps the sentence-level function as a single flatMap over words.
 */
function getDerivedDistractorUnsafeSentencesForWord(
  sentence: SentenceWithDistractorUnsafeTexts,
  word: VocabularyDistractorUnsafeWord,
  targetWordsByTranslation: Map<string, string[]>,
): string[] {
  return getMatchedTranslationsInSentence(sentence, word).flatMap((translation) =>
    getEquivalentWordsForTranslation(translation, targetWordsByTranslation).flatMap(
      (equivalentWord) => getReplacementVariant(sentence.sentence, word.word, equivalentWord),
    ),
  );
}

/**
 * Create extra source-language sentences by swapping one lesson word for another word
 * that has the same translation.
 * Example: if both "Guten Morgen" and "Guten Tag" map to "Bom dia", then
 * "Guten Morgen, Anna!" can also accept "Guten Tag, Anna!".
 */
function getDerivedDistractorUnsafeSentences(
  sentence: SentenceWithDistractorUnsafeTexts,
  words: VocabularyDistractorUnsafeWord[],
  targetWordsByTranslation: Map<string, string[]>,
): string[] {
  return words.flatMap((word) =>
    getDerivedDistractorUnsafeSentencesForWord(sentence, word, targetWordsByTranslation),
  );
}

/**
 * Generate all extra learner-language texts contributed by one matched vocabulary word.
 * This names the "same source word, different distractor-unsafe translation" rule directly.
 */
function getDerivedDistractorUnsafeTranslationsForWord(
  sentence: SentenceWithDistractorUnsafeTexts,
  word: VocabularyDistractorUnsafeWord,
): string[] {
  return getMatchedTranslationsInSentence(sentence, word).flatMap((translation) =>
    getWordTranslations(word).flatMap((equivalentTranslation) =>
      getReplacementVariant(sentence.translation, translation, equivalentTranslation),
    ),
  );
}

/**
 * Create extra translation variants from the distractor-unsafe translations attached
 * to the matched word. Example: if "Hallo" blocks both "Olá" and "Oi" from appearing
 * as distractors, then "Olá, Lara!" also needs "Oi, Lara!" blocked as a distractor.
 */
function getDerivedDistractorUnsafeTranslations(
  sentence: SentenceWithDistractorUnsafeTexts,
  words: VocabularyDistractorUnsafeWord[],
): string[] {
  return words.flatMap((word) => getDerivedDistractorUnsafeTranslationsForWord(sentence, word));
}

/**
 * Merge AI-proposed distractor blocks with the lesson-backed blocks we derived
 * from vocabulary data, then deduplicate and drop anything that is just a copy
 * of the canonical text.
 */
function getMergedDistractorUnsafeTexts(params: {
  canonicalText: string;
  candidateTexts: string[];
  derivedTexts: string[];
}): string[] {
  return mergeDistractorUnsafeTexts(params.canonicalText, [
    ...params.candidateTexts,
    ...params.derivedTexts,
  ]);
}

/**
 * Merges AI-generated distractor-unsafe texts with deterministic texts derived
 * from lesson vocabulary data, then deduplicates. AI outputs are trusted as-is
 * because the prompt already constrains what should be blocked from distractors.
 *
 * Deterministic texts are derived when two vocabulary words share a translation
 * (e.g., "Guten Morgen" and "Guten Tag" both map to "Bom dia"), allowing
 * extra distractor blocks to be generated from vocabulary overlap.
 */
export function mergeReadingSentenceDistractorUnsafeVariants<
  T extends SentenceWithDistractorUnsafeTexts,
>(sentences: T[], words: VocabularyDistractorUnsafeWord[]): T[] {
  const targetWordsByTranslation = buildTargetWordsByTranslation(words);

  return sentences.map((sentence) => {
    const derivedDistractorUnsafeSentences = getDerivedDistractorUnsafeSentences(
      sentence,
      words,
      targetWordsByTranslation,
    );

    const derivedDistractorUnsafeTranslations = getDerivedDistractorUnsafeTranslations(
      sentence,
      words,
    );

    return {
      ...sentence,
      distractorUnsafeSentences: getMergedDistractorUnsafeTexts({
        candidateTexts: sentence.distractorUnsafeSentences,
        canonicalText: sentence.sentence,
        derivedTexts: derivedDistractorUnsafeSentences,
      }),
      distractorUnsafeTranslations: getMergedDistractorUnsafeTexts({
        candidateTexts: sentence.distractorUnsafeTranslations,
        canonicalText: sentence.translation,
        derivedTexts: derivedDistractorUnsafeTranslations,
      }),
    };
  });
}
