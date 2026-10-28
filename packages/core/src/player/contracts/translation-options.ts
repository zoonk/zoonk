import { normalizeDistractorKey, sanitizeDistractors } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import { normalizePunctuation } from "@zoonk/utils/string";
import { getTileRomanization } from "./_utils/tile-romanization";

const VOCABULARY_DISTRACTOR_COUNT = 3;
const FIRST_LETTER_PATTERN = /\p{L}/u;
const TERMINAL_PUNCTUATION_PATTERN = /[.!?…。！？؟]+$/u;

/** romanization is null for Latin-script words. */
export type TranslationOption = {
  id: string;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
};

export type DistractorWord = {
  id: string;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
};

type TranslationSourceWord = {
  id: string;
  word: string;
  translation: string;
  distractors: string[];
  romanization: string | null;
  audioUrl: string | null;
};

export function serializeDistractorWord(word: DistractorWord): DistractorWord {
  return { audioUrl: word.audioUrl, id: word.id, romanization: word.romanization, word: word.word };
}

function toTranslationOption(word: TranslationSourceWord | DistractorWord): TranslationOption {
  return {
    audioUrl: word.audioUrl,
    id: word.id,
    romanization: getTileRomanization({ romanization: word.romanization, word: word.word }),
    word: word.word,
  };
}

function isCasedLetter(letter: string): boolean {
  return letter.toLocaleLowerCase() !== letter.toLocaleUpperCase();
}

/** Normalize visible option casing so formatting cannot identify the correct answer. */
function capitalizeFirstCasedLetter(text: string): string {
  const firstLetter = FIRST_LETTER_PATTERN.exec(text)?.[0];

  if (!firstLetter || !isCasedLetter(firstLetter)) {
    return text;
  }

  return text.replace(FIRST_LETTER_PATTERN, (letter) => letter.toLocaleUpperCase());
}

function getTerminalPunctuation(text: string): string {
  const normalizedText = normalizePunctuation(text).trim();

  return TERMINAL_PUNCTUATION_PATTERN.exec(normalizedText)?.[0] ?? "";
}

function stripTerminalPunctuation(text: string): string {
  return normalizePunctuation(text).trim().replace(TERMINAL_PUNCTUATION_PATTERN, "").trimEnd();
}

function normalizeTranslationOptionWord(params: {
  optionWord: string;
  terminalPunctuation: string;
}): string {
  const textWithoutPunctuation = stripTerminalPunctuation(params.optionWord);
  const textWithPunctuation = `${textWithoutPunctuation}${params.terminalPunctuation}`;

  return capitalizeFirstCasedLetter(textWithPunctuation);
}

/** Keep original metadata/ids while normalizing labels so formatting cannot reveal the correct answer. */
function normalizeTranslationOption(params: {
  option: TranslationOption;
  terminalPunctuation: string;
}): TranslationOption {
  return {
    ...params.option,
    word: normalizeTranslationOptionWord({
      optionWord: params.option.word,
      terminalPunctuation: params.terminalPunctuation,
    }),
  };
}

function buildFallbackDistractorOption(params: { key: string; word: string }): TranslationOption {
  return { audioUrl: null, id: `distractor:${params.key}`, romanization: null, word: params.word };
}

function buildDirectDistractorOption(params: {
  distractorLookup: Map<string, DistractorWord>;
  word: string;
}): TranslationOption {
  const distractorKey = normalizeDistractorKey(params.word);
  const hydrated = params.distractorLookup.get(distractorKey);

  if (hydrated) {
    return toTranslationOption(hydrated);
  }

  return buildFallbackDistractorOption({ key: distractorKey, word: params.word });
}

/** Missing enrichment still renders a plain distractor option. */
export function buildDistractorWordLookup(
  distractorWords: DistractorWord[],
): Map<string, DistractorWord> {
  return new Map(distractorWords.map((word) => [normalizeDistractorKey(word.word), word] as const));
}

/** Uses stored direct distractors and shows at most three after normalization. */
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
    .map((word) => buildDirectDistractorOption({ distractorLookup: params.distractorLookup, word }))
    .slice(0, VOCABULARY_DISTRACTOR_COUNT);

  const terminalPunctuation = getTerminalPunctuation(params.word.translation);

  const options = [toTranslationOption(params.word), ...directDistractors].map((option) =>
    normalizeTranslationOption({ option, terminalPunctuation }),
  );

  return shuffle(options);
}
