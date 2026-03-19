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

// The same accepted translation can arrive with tiny formatting differences, such as
// "Bonjour !" vs "Bonjour!". Clean and deduplicate that list once here so the rest
// of this file compares one stable set of translations.
function getWordTranslations(word: VocabularyVariantWord): string[] {
  return deduplicateNormalizedTexts([word.translation, ...word.alternativeTranslations]);
}

// Keep one shared rule for "does this exact expression appear in this text?" so every
// caller makes the same decision.
function hasPhrase(text: string, phrase: string): boolean {
  return hasWholePhrase(text, phrase);
}

// When we build a new variant, replace only the exact expression we matched above.
// This avoids changing unrelated text by accident.
function replacePhrase(text: string, search: string, replacement: string): string | null {
  return replaceWholePhrase(text, search, replacement);
}

// We can receive alternatives from the AI and from our own lesson-word rules.
// Merge them into one clean list, remove duplicates like "Bom dia !" vs "Bom dia!",
// and drop anything that is just a copy of the main sentence.
function mergeAlternativeTexts(primaryText: string, texts: string[]): string[] {
  const primaryKey = normalizeString(normalizePunctuation(primaryText).trim());

  return deduplicateNormalizedTexts(texts).filter((text) => normalizeString(text) !== primaryKey);
}

// Turn a sentence into the set of lesson expressions it actually uses.
// That lets us answer questions like "did this variant introduce a different lesson term?"
// without depending on the full raw sentence text.
function getPhraseKeys(text: string, phrases: string[]): Set<string> {
  return new Set(
    phrases.flatMap((phrase) => {
      const normalizedPhrase = normalizePunctuation(phrase).trim();

      if (!normalizedPhrase || !hasPhrase(text, normalizedPhrase)) {
        return [];
      }

      return [normalizeString(normalizedPhrase)];
    }),
  );
}

// Keep AI rewrites that do not introduce a different taught expression, but reject rewrites
// that swap in a new lesson term unless our lesson-word data says that swap is allowed.
// Example: "Yo soy Lara." -> "Soy Lara." is fine because it does not introduce a new term.
// Example: "Guten Tag" -> "Guten Morgen" is only allowed when the lesson data says both are
// accepted ways to express the same translation here.
function filterLexicalVariants(params: {
  canonicalText: string;
  candidateTexts: string[];
  licensedVariantTexts: string[];
  phrases: string[];
}): string[] {
  const canonicalPhraseKeys = getPhraseKeys(params.canonicalText, params.phrases);

  const licensedVariantKeys = new Set(
    params.licensedVariantTexts.flatMap((text) => {
      const normalized = normalizePunctuation(text).trim();
      return normalized ? [normalizeString(normalized)] : [];
    }),
  );

  return params.candidateTexts.filter((candidateText) => {
    const candidatePhraseKeys = getPhraseKeys(candidateText, params.phrases);

    const introducesLessonPhrase = [...candidatePhraseKeys].some(
      (phraseKey) => !canonicalPhraseKeys.has(phraseKey),
    );

    if (!introducesLessonPhrase) {
      return true;
    }

    const normalizedCandidate = normalizePunctuation(candidateText).trim();

    return licensedVariantKeys.has(normalizeString(normalizedCandidate));
  });
}

// Build a lookup from a translation to every source-language word that can mean the same thing.
// Example: "Bom dia" can point to both "Guten Morgen" and "Guten Tag".
// We use that later to create allowed extra sentence variants without repeatedly scanning all words.
function buildTargetWordsByTranslation(words: VocabularyVariantWord[]): Map<string, string[]> {
  const targetWordsByTranslation = new Map<string, string[]>();

  for (const word of words) {
    const normalizedWord = normalizePunctuation(word.word).trim();

    for (const translation of getWordTranslations(word)) {
      const key = normalizeString(translation);
      const currentWords = targetWordsByTranslation.get(key) ?? [];

      targetWordsByTranslation.set(
        key,
        deduplicateNormalizedTexts([...currentWords, normalizedWord]),
      );
    }
  }

  return targetWordsByTranslation;
}

// Create extra source-language sentences by swapping one lesson word for another word
// that has the same translation.
// Example: if both "Guten Morgen" and "Guten Tag" map to "Bom dia", then
// "Guten Morgen, Anna!" can also accept "Guten Tag, Anna!".
function getDerivedAlternativeSentences(
  sentence: SentenceWithVariants,
  words: VocabularyVariantWord[],
  targetWordsByTranslation: Map<string, string[]>,
): string[] {
  return words.flatMap((word) => {
    if (!hasPhrase(sentence.sentence, word.word)) {
      return [];
    }

    const translationsInSentence = getWordTranslations(word).filter((translation) =>
      hasPhrase(sentence.translation, translation),
    );

    return translationsInSentence.flatMap((translation) => {
      const equivalentWords = targetWordsByTranslation.get(normalizeString(translation)) ?? [];

      return equivalentWords.flatMap((equivalentWord) => {
        if (normalizeString(equivalentWord) === normalizeString(word.word)) {
          return [];
        }

        const derivedSentence = replacePhrase(sentence.sentence, word.word, equivalentWord);
        return derivedSentence ? [derivedSentence] : [];
      });
    });
  });
}

// Create extra translation variants from the accepted translations attached to the matched word.
// Example: if "Hallo" accepts both "Olá" and "Oi", then "Olá, Lara!" can also accept
// "Oi, Lara!".
function getDerivedAlternativeTranslations(
  sentence: SentenceWithVariants,
  words: VocabularyVariantWord[],
): string[] {
  return words.flatMap((word) => {
    if (!hasPhrase(sentence.sentence, word.word)) {
      return [];
    }

    const translationsInSentence = getWordTranslations(word).filter((translation) =>
      hasPhrase(sentence.translation, translation),
    );

    return translationsInSentence.flatMap((translation) =>
      getWordTranslations(word).flatMap((equivalentTranslation) => {
        if (normalizeString(equivalentTranslation) === normalizeString(translation)) {
          return [];
        }

        const derivedTranslation = replacePhrase(
          sentence.translation,
          translation,
          equivalentTranslation,
        );

        return derivedTranslation ? [derivedTranslation] : [];
      }),
    );
  });
}

// Final pass: combine the AI's suggestions with the alternatives we can prove from lesson data.
// Then drop anything that introduces a different taught expression unless we can prove that
// the new expression is an accepted equivalent for this lesson.
// Example: keep "Guten Tag, Anna!" as an alternative for "Guten Morgen, Anna!" when both map
// to "Bom dia". Drop an AI variant like "Guten Abend, Anna!" if the lesson never says that it
// is another accepted way to express that same translation here.
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
      alternativeSentences: mergeAlternativeTexts(sentence.sentence, [
        ...filterLexicalVariants({
          candidateTexts: sentence.alternativeSentences,
          canonicalText: sentence.sentence,
          licensedVariantTexts: derivedAlternativeSentences,
          phrases: words.map((word) => word.word),
        }),
        ...derivedAlternativeSentences,
      ]),
      alternativeTranslations: mergeAlternativeTexts(sentence.translation, [
        ...filterLexicalVariants({
          candidateTexts: sentence.alternativeTranslations,
          canonicalText: sentence.translation,
          licensedVariantTexts: derivedAlternativeTranslations,
          phrases: translationPhrases,
        }),
        ...derivedAlternativeTranslations,
      ]),
    };
  });
}
