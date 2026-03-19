import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import {
  deduplicateNormalizedTexts,
  hasWholePhrase,
  normalizePunctuation,
  normalizeString,
  replaceWholePhrase,
} from "@zoonk/utils/string";

type SentenceWithVariants = {
  alternativeSentences: string[];
  alternativeTranslations: string[];
  sentence: string;
  translation: string;
};

type VocabularyVariantWord = Pick<
  VocabularyWord,
  "alternativeTranslations" | "translation" | "word"
>;

/**
 * The same accepted translation can arrive with tiny formatting differences, such as
 * "Bonjour !" vs "Bonjour!". Clean and deduplicate that list once here so the rest
 * of this file compares one stable set of translations.
 */
function getWordTranslations(word: VocabularyVariantWord): string[] {
  return deduplicateNormalizedTexts([word.translation, ...word.alternativeTranslations]);
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
 * Turn any accepted text into the stable lookup key used throughout this file.
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
 * Build a reusable set of lookup keys from a list of texts so callers can ask
 * membership questions without repeating null checks and normalization.
 */
function getTextKeys(texts: string[]): Set<string> {
  return new Set(
    texts.map((text) => getTextKey(text)).filter((textKey): textKey is string => textKey !== null),
  );
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
 * We can receive alternatives from the AI and from our own lesson-word rules.
 * Merge them into one clean list, remove duplicates like "Bom dia !" vs "Bom dia!",
 * and drop anything that is just a copy of the main sentence.
 */
function mergeAlternativeTexts(primaryText: string, texts: string[]): string[] {
  const primaryKey = getTextKey(primaryText);

  return deduplicateNormalizedTexts(texts).filter((text) => getTextKey(text) !== primaryKey);
}

/**
 * Match one lesson phrase against a sentence and return its lookup key only when that
 * exact phrase is present. This keeps getPhraseKeys as a simple collection pipeline.
 */
function getMatchedPhraseKey(text: string, phrase: string): string | null {
  const normalizedPhrase = getNormalizedText(phrase);

  if (!normalizedPhrase || !hasPhrase(text, normalizedPhrase)) {
    return null;
  }

  return normalizeString(normalizedPhrase);
}

/**
 * Turn a sentence into the set of lesson expressions it actually uses.
 * That lets us answer questions like "did this variant introduce a different lesson term?"
 * without depending on the full raw sentence text.
 */
function getPhraseKeys(text: string, phrases: string[]): Set<string> {
  return new Set(
    phrases
      .map((phrase) => getMatchedPhraseKey(text, phrase))
      .filter((phraseKey): phraseKey is string => phraseKey !== null),
  );
}

/**
 * Decide whether a candidate sentence introduces a taught phrase that the canonical
 * version does not use. That lets the higher-level filter focus on policy, not matching.
 */
function introducesLessonPhrase(
  candidateText: string,
  canonicalPhraseKeys: Set<string>,
  phrases: string[],
): boolean {
  const candidatePhraseKeys = getPhraseKeys(candidateText, phrases);

  return [...candidatePhraseKeys].some((phraseKey) => !canonicalPhraseKeys.has(phraseKey));
}

/**
 * Check whether a candidate text is one of the variants explicitly licensed by lesson-word
 * data after normalization.
 */
function isLicensedVariant(candidateText: string, licensedVariantKeys: Set<string>): boolean {
  const candidateKey = getTextKey(candidateText);

  return candidateKey ? licensedVariantKeys.has(candidateKey) : false;
}

/**
 * Keep candidates that either stay within the canonical lesson phrases or match a
 * lesson-approved equivalent we derived from the vocabulary data.
 */
function canKeepLexicalVariant(params: {
  candidateText: string;
  canonicalPhraseKeys: Set<string>;
  licensedVariantKeys: Set<string>;
  phrases: string[];
}): boolean {
  if (!introducesLessonPhrase(params.candidateText, params.canonicalPhraseKeys, params.phrases)) {
    return true;
  }

  return isLicensedVariant(params.candidateText, params.licensedVariantKeys);
}

/**
 * Keep AI rewrites that do not introduce a different taught expression, but reject rewrites
 * that swap in a new lesson term unless our lesson-word data says that swap is allowed.
 * Example: "Yo soy Lara." -> "Soy Lara." is fine because it does not introduce a new term.
 * Example: "Guten Tag" -> "Guten Morgen" is only allowed when the lesson data says both are
 * accepted ways to express the same translation here.
 */
function filterLexicalVariants(params: {
  canonicalText: string;
  candidateTexts: string[];
  licensedVariantTexts: string[];
  phrases: string[];
}): string[] {
  const canonicalPhraseKeys = getPhraseKeys(params.canonicalText, params.phrases);
  const licensedVariantKeys = getTextKeys(params.licensedVariantTexts);

  return params.candidateTexts.filter((candidateText) =>
    canKeepLexicalVariant({
      candidateText,
      canonicalPhraseKeys,
      licensedVariantKeys,
      phrases: params.phrases,
    }),
  );
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
function buildTargetWordsByTranslation(words: VocabularyVariantWord[]): Map<string, string[]> {
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
 * Find which accepted translations from a vocabulary word actually appear in this sentence pair.
 * Both derived-variant builders need this same matching step.
 */
function getMatchedTranslationsInSentence(
  sentence: SentenceWithVariants,
  word: VocabularyVariantWord,
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
function getDerivedAlternativeSentencesForWord(
  sentence: SentenceWithVariants,
  word: VocabularyVariantWord,
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
function getDerivedAlternativeSentences(
  sentence: SentenceWithVariants,
  words: VocabularyVariantWord[],
  targetWordsByTranslation: Map<string, string[]>,
): string[] {
  return words.flatMap((word) =>
    getDerivedAlternativeSentencesForWord(sentence, word, targetWordsByTranslation),
  );
}

/**
 * Generate all extra target-language variants contributed by one matched vocabulary word.
 * This names the "same source word, alternative accepted translation" rule directly.
 */
function getDerivedAlternativeTranslationsForWord(
  sentence: SentenceWithVariants,
  word: VocabularyVariantWord,
): string[] {
  return getMatchedTranslationsInSentence(sentence, word).flatMap((translation) =>
    getWordTranslations(word).flatMap((equivalentTranslation) =>
      getReplacementVariant(sentence.translation, translation, equivalentTranslation),
    ),
  );
}

/**
 * Create extra translation variants from the accepted translations attached to the matched word.
 * Example: if "Hallo" accepts both "Olá" and "Oi", then "Olá, Lara!" can also accept
 * "Oi, Lara!".
 */
function getDerivedAlternativeTranslations(
  sentence: SentenceWithVariants,
  words: VocabularyVariantWord[],
): string[] {
  return words.flatMap((word) => getDerivedAlternativeTranslationsForWord(sentence, word));
}

/**
 * Merge AI-proposed variants with the lesson-backed variants we can prove are allowed,
 * then run the shared dedupe rules once at the end.
 */
function getAcceptedAlternativeTexts(params: {
  canonicalText: string;
  candidateTexts: string[];
  derivedTexts: string[];
  phrases: string[];
}): string[] {
  return mergeAlternativeTexts(params.canonicalText, [
    ...filterLexicalVariants({
      candidateTexts: params.candidateTexts,
      canonicalText: params.canonicalText,
      licensedVariantTexts: params.derivedTexts,
      phrases: params.phrases,
    }),
    ...params.derivedTexts,
  ]);
}

/**
 * Final pass: combine the AI's suggestions with the alternatives we can prove from lesson data.
 * Then drop anything that introduces a different taught expression unless we can prove that
 * the new expression is an accepted equivalent for this lesson.
 * Example: keep "Guten Tag, Anna!" as an alternative for "Guten Morgen, Anna!" when both map
 * to "Bom dia". Drop an AI variant like "Guten Abend, Anna!" if the lesson never says that it
 * is another accepted way to express that same translation here.
 */
export function enrichReadingSentenceVariants<T extends SentenceWithVariants>(
  sentences: T[],
  words: VocabularyVariantWord[],
): T[] {
  const targetWordsByTranslation = buildTargetWordsByTranslation(words);
  const translationPhrases = deduplicateNormalizedTexts(
    words.flatMap((word) => getWordTranslations(word)),
  );

  return sentences.map((sentence) => {
    const derivedAlternativeSentences = getDerivedAlternativeSentences(
      sentence,
      words,
      targetWordsByTranslation,
    );

    const derivedAlternativeTranslations = getDerivedAlternativeTranslations(sentence, words);

    return {
      ...sentence,
      alternativeSentences: getAcceptedAlternativeTexts({
        candidateTexts: sentence.alternativeSentences,
        canonicalText: sentence.sentence,
        derivedTexts: derivedAlternativeSentences,
        phrases: words.map((word) => word.word),
      }),
      alternativeTranslations: getAcceptedAlternativeTexts({
        candidateTexts: sentence.alternativeTranslations,
        canonicalText: sentence.translation,
        derivedTexts: derivedAlternativeTranslations,
        phrases: translationPhrases,
      }),
    };
  });
}
