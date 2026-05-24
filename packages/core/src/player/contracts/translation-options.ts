import { normalizeDistractorKey, sanitizeDistractors } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import { normalizePunctuation } from "@zoonk/utils/string";

const VOCABULARY_DISTRACTOR_COUNT = 3;
const FIRST_LETTER_PATTERN = /\p{L}/u;
const TERMINAL_PUNCTUATION_PATTERN = /[.!?…。！？؟]+$/u;

type InitialCasing = "lowercase" | "none" | "uppercase";

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
  translation: string;
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
 * Some scripts do not have uppercase/lowercase forms. Treat those as neutral so
 * translation options in scripts like Japanese or Chinese keep their original text.
 */
function isCasedLetter(letter: string): boolean {
  return letter.toLocaleLowerCase() !== letter.toLocaleUpperCase();
}

/**
 * The correct target-language answer defines the casing style learners should see.
 * Matching distractors to that first-letter style removes answer leaks such as only the
 * correct option starting with an uppercase letter.
 */
function getInitialCasing(text: string): InitialCasing {
  const firstLetter = FIRST_LETTER_PATTERN.exec(text)?.[0];

  if (!firstLetter || !isCasedLetter(firstLetter)) {
    return "none";
  }

  if (firstLetter === firstLetter.toLocaleUpperCase()) {
    return "uppercase";
  }

  return "lowercase";
}

/**
 * Applies one shared first-letter casing style while preserving the rest of the option.
 * This keeps phrases like "Bom dia" sentence-cased without title-casing every word.
 */
function applyInitialCasing(params: { casing: InitialCasing; text: string }): string {
  if (params.casing === "none") {
    return params.text;
  }

  return params.text.replace(FIRST_LETTER_PATTERN, (letter) =>
    params.casing === "uppercase" ? letter.toLocaleUpperCase() : letter.toLocaleLowerCase(),
  );
}

/**
 * The prompt is what learners are translating, so its terminal punctuation is the
 * reference for every answer option. Returning only the final punctuation run handles
 * cases like "Good morning!" and "Really?!" without changing internal punctuation.
 */
function getTerminalPunctuation(text: string): string {
  const normalizedText = normalizePunctuation(text).trim();

  return TERMINAL_PUNCTUATION_PATTERN.exec(normalizedText)?.[0] ?? "";
}

/**
 * Distractors often arrive with punctuation that belongs to a different prompt. Strip
 * only terminal sentence punctuation so internal punctuation and accents stay intact.
 */
function stripTerminalPunctuation(text: string): string {
  return normalizePunctuation(text).trim().replace(TERMINAL_PUNCTUATION_PATTERN, "").trimEnd();
}

/**
 * Rebuilds an option label from the two learner-visible references: answer casing from
 * the correct target word and ending punctuation from the prompt being translated.
 */
function normalizeTranslationOptionWord(params: {
  casing: InitialCasing;
  optionWord: string;
  terminalPunctuation: string;
}): string {
  const textWithoutPunctuation = stripTerminalPunctuation(params.optionWord);
  const textWithPunctuation = `${textWithoutPunctuation}${params.terminalPunctuation}`;

  return applyInitialCasing({ casing: params.casing, text: textWithPunctuation });
}

/**
 * Metadata and IDs must keep pointing at the original word records, but the visible label
 * should be normalized so option formatting cannot identify the correct answer.
 */
function normalizeTranslationOption(params: {
  casing: InitialCasing;
  option: TranslationOption;
  terminalPunctuation: string;
}): TranslationOption {
  return {
    ...params.option,
    word: normalizeTranslationOptionWord({
      casing: params.casing,
      optionWord: params.option.word,
      terminalPunctuation: params.terminalPunctuation,
    }),
  };
}

/**
 * Generated distractor text is still usable when we cannot hydrate it from a word
 * record. Keep the normalized key in the ID so the fallback stays stable across casing
 * and punctuation differences in regenerated content.
 */
function buildFallbackDistractorOption(params: { key: string; word: string }): TranslationOption {
  return {
    audioUrl: null,
    id: `distractor:${params.key}`,
    pronunciation: null,
    romanization: null,
    word: params.word,
  };
}

/**
 * Direct distractors are stored as text, while enriched distractors are fetched as word
 * records. This joins those paths before display normalization so both hydrated and
 * fallback distractors receive the same casing and punctuation treatment.
 */
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

/**
 * Target-language distractors are looked up by normalized surface text. Missing word
 * records still render as plain options so the lesson keeps working even if enrichment
 * underflows.
 */
export function buildDistractorWordLookup(
  distractorWords: DistractorWord[],
): Map<string, DistractorWord> {
  return new Map(distractorWords.map((word) => [normalizeDistractorKey(word.word), word] as const));
}

/**
 * Translation lessons read the stored direct distractor list from `ChapterWord`. The
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
    .map((word) => buildDirectDistractorOption({ distractorLookup: params.distractorLookup, word }))
    .slice(0, VOCABULARY_DISTRACTOR_COUNT);

  const casing = getInitialCasing(params.word.word);
  const terminalPunctuation = getTerminalPunctuation(params.word.translation);

  const options = [toTranslationOption(params.word), ...directDistractors].map((option) =>
    normalizeTranslationOption({ casing, option, terminalPunctuation }),
  );

  return shuffle(options);
}
