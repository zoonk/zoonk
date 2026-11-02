import { normalizeDistractorKey, sanitizeDistractors } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import { normalizePunctuation } from "@zoonk/utils/string";
import { getTileRomanization } from "./_utils/tile-romanization";

const VOCABULARY_DISTRACTOR_COUNT = 3;
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

function getTerminalPunctuation(text: string): string {
  const normalizedText = normalizePunctuation(text).trim();

  return TERMINAL_PUNCTUATION_PATTERN.exec(normalizedText)?.[0] ?? "";
}

function stripTerminalPunctuation(text: string): string {
  return normalizePunctuation(text).trim().replace(TERMINAL_PUNCTUATION_PATTERN, "").trimEnd();
}

/**
 * Every option ends like the prompt so punctuation can't reveal the answer. Letter case stays as
 * written: it is part of the spelling ("essen" and "Essen", "sie" and "Sie").
 */
function matchTerminalPunctuation(params: {
  option: TranslationOption;
  terminalPunctuation: string;
}): TranslationOption {
  return {
    ...params.option,
    word: `${stripTerminalPunctuation(params.option.word)}${params.terminalPunctuation}`,
  };
}

function buildFallbackDistractorOption(params: { key: string; word: string }): TranslationOption {
  return { audioUrl: null, id: `distractor:${params.key}`, romanization: null, word: params.word };
}

function buildDirectDistractorOption(params: {
  distractorLookup: Map<string, DistractorWord>;
  word: string;
}): TranslationOption {
  const hydrated = params.distractorLookup.get(params.word);

  if (hydrated) {
    return toTranslationOption(hydrated);
  }

  return buildFallbackDistractorOption({
    key: normalizeDistractorKey(params.word),
    word: params.word,
  });
}

/** Keyed by exact text: a row that differs in case, accent or punctuation is another word. */
export function buildDistractorWordLookup(
  distractorWords: DistractorWord[],
): Map<string, DistractorWord> {
  return new Map(distractorWords.map((word) => [word.word, word] as const));
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
    matchTerminalPunctuation({ option, terminalPunctuation }),
  );

  return shuffle(options);
}
