import { normalizeDistractorKey, sanitizeDistractors } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";

const VOCABULARY_DISTRACTOR_COUNT = 3;

export type TranslationOption = {
  id: string;
  word: string;
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

export type DistractorWord = {
  id: string;
  word: string;
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

type TranslationSourceWord = {
  id: string;
  word: string;
  distractors: string[];
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

/**
 * Direct distractor words do not need lesson translations, only render metadata.
 */
export function serializeDistractorWord(word: {
  id: string;
  word: string;
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
}): DistractorWord {
  return {
    audioUrl: word.audioUrl,
    id: word.id,
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    word: word.word,
  };
}

/**
 * Translation options only need the target-language surface form plus audio and
 * pronunciation metadata.
 */
function toTranslationOption(word: TranslationSourceWord | DistractorWord): TranslationOption {
  return {
    audioUrl: word.audioUrl,
    id: word.id,
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    word: word.word,
  };
}

/**
 * Target-language distractors are looked up by normalized surface text. Missing word
 * records still render as plain options so the activity keeps working even if enrichment
 * underflows.
 */
export function buildDistractorWordLookup(
  distractorWords: DistractorWord[],
): Map<string, DistractorWord> {
  return new Map(distractorWords.map((word) => [normalizeDistractorKey(word.word), word] as const));
}

/**
 * Translation activities read the stored direct distractor list from `LessonWord`. The
 * player only sanitizes, hydrates what metadata exists, and shows the first three.
 */
export function buildTranslationOptions(params: {
  distractorLookup: Map<string, DistractorWord>;
  kind: string;
  word: TranslationSourceWord | null;
}): TranslationOption[] {
  if (params.kind !== "translation" || !params.word) {
    return [];
  }

  const directDistractors = sanitizeDistractors({
    distractors: params.word.distractors,
    input: params.word.word,
    shape: "any",
  })
    .map((word) => {
      const hydrated = params.distractorLookup.get(normalizeDistractorKey(word));

      return hydrated
        ? toTranslationOption(hydrated)
        : {
            audioUrl: null,
            id: `distractor:${normalizeDistractorKey(word)}`,
            pronunciation: null,
            romanization: null,
            word,
          };
    })
    .slice(0, VOCABULARY_DISTRACTOR_COUNT);

  return shuffle([toTranslationOption(params.word), ...directDistractors]);
}
