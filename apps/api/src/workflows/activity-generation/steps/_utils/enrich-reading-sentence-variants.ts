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

function getWordTranslations(word: VocabularyVariantWord): string[] {
  return [
    ...new Map(
      [word.translation, ...word.alternativeTranslations].flatMap((translation) => {
        const normalized = normalizePunctuation(translation).trim();

        return normalized ? [[normalizeString(normalized), normalized] as const] : [];
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
        const key = normalizeString(normalized);

        if (!normalized || key === normalizeString(primaryText)) {
          return [];
        }

        return [[key, normalized] as const];
      }),
    ).values(),
  ];
}

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

function buildTargetWordsByTranslation(words: VocabularyVariantWord[]): Map<string, string[]> {
  const targetWordsByTranslation = new Map<string, string[]>();

  for (const word of words) {
    const normalizedWord = normalizePunctuation(word.word).trim();

    for (const translation of getWordTranslations(word)) {
      const key = normalizeString(translation);
      const currentWords = targetWordsByTranslation.get(key) ?? [];
      const nextWords = currentWords.some(
        (currentWord) => normalizeString(currentWord) === normalizeString(normalizedWord),
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

export function enrichReadingSentenceVariants<T extends SentenceWithVariants>(
  sentences: T[],
  words: VocabularyVariantWord[],
): T[] {
  const targetWordsByTranslation = buildTargetWordsByTranslation(words);
  const translationPhrases = [
    ...new Map(
      words.flatMap((word) =>
        getWordTranslations(word).flatMap((translation) => {
          const normalized = normalizePunctuation(translation).trim();
          return normalized ? [[normalizeString(normalized), normalized] as const] : [];
        }),
      ),
    ).values(),
  ];

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
