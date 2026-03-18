import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { normalizePunctuation, normalizeString } from "@zoonk/utils/string";

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

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function normalizeVariantKey(text: string): string {
  return normalizeString(text);
}

function getWordTranslations(word: VocabularyVariantWord): string[] {
  return [
    ...new Map(
      [word.translation, ...word.alternativeTranslations].flatMap((translation) => {
        const normalized = normalizePunctuation(translation).trim();

        return normalized ? [[normalizeVariantKey(normalized), normalized] as const] : [];
      }),
    ).values(),
  ];
}

function createPhrasePattern(phrase: string): RegExp {
  const normalizedPhrase = normalizePunctuation(phrase).trim();
  const escapedPhrase = escapeRegExp(normalizedPhrase).replaceAll(String.raw`\ `, String.raw`\s+`);

  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedPhrase})(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function hasPhrase(text: string, phrase: string): boolean {
  return createPhrasePattern(phrase).test(normalizePunctuation(text));
}

function replacePhrase(text: string, search: string, replacement: string): string | null {
  const pattern = createPhrasePattern(search);
  const normalizedText = normalizePunctuation(text);

  if (!pattern.test(normalizedText)) {
    return null;
  }

  return normalizedText.replace(pattern, (_match, prefix: string) => `${prefix}${replacement}`);
}

function mergeAlternativeTexts(primaryText: string, texts: string[]): string[] {
  return [
    ...new Map(
      texts.flatMap((text) => {
        const normalized = normalizePunctuation(text).trim();
        const key = normalizeVariantKey(normalized);

        if (!normalized || key === normalizeVariantKey(primaryText)) {
          return [];
        }

        return [[key, normalized] as const];
      }),
    ).values(),
  ];
}

function buildTargetWordsByTranslation(words: VocabularyVariantWord[]): Map<string, string[]> {
  const targetWordsByTranslation = new Map<string, string[]>();

  for (const word of words) {
    const normalizedWord = normalizePunctuation(word.word).trim();

    for (const translation of getWordTranslations(word)) {
      const key = normalizeVariantKey(translation);
      const currentWords = targetWordsByTranslation.get(key) ?? [];
      const nextWords = currentWords.some(
        (currentWord) => normalizeVariantKey(currentWord) === normalizeVariantKey(normalizedWord),
      )
        ? currentWords
        : [...currentWords, normalizedWord];

      targetWordsByTranslation.set(key, nextWords);
    }
  }

  return targetWordsByTranslation;
}

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
      const equivalentWords = targetWordsByTranslation.get(normalizeVariantKey(translation)) ?? [];

      return equivalentWords.flatMap((equivalentWord) => {
        if (normalizeVariantKey(equivalentWord) === normalizeVariantKey(word.word)) {
          return [];
        }

        const derivedSentence = replacePhrase(sentence.sentence, word.word, equivalentWord);
        return derivedSentence ? [derivedSentence] : [];
      });
    });
  });
}

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
        if (normalizeVariantKey(equivalentTranslation) === normalizeVariantKey(translation)) {
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

export function enrichReadingSentenceVariants<T extends SentenceWithVariants>(
  sentences: T[],
  words: VocabularyVariantWord[],
): T[] {
  const targetWordsByTranslation = buildTargetWordsByTranslation(words);

  return sentences.map((sentence) => ({
    ...sentence,
    alternativeSentences: mergeAlternativeTexts(sentence.sentence, [
      ...sentence.alternativeSentences,
      ...getDerivedAlternativeSentences(sentence, words, targetWordsByTranslation),
    ]),
    alternativeTranslations: mergeAlternativeTexts(sentence.translation, [
      ...sentence.alternativeTranslations,
      ...getDerivedAlternativeTranslations(sentence, words),
    ]),
  }));
}
