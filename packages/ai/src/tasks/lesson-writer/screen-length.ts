/** A tweet: the most a lesson screen asks the learner to read at once, at every level. */
export const MAX_SCREEN_CHARACTERS = 250;

/**
 * Twitter's weighted length: Latin, Greek, Cyrillic, Arabic, Hebrew, Indic scripts and general
 * punctuation count once, and every other character (Chinese, Japanese, Korean, emoji) twice, since
 * one of them carries about as much as two letters.
 */
const DOUBLE_WEIGHT = /[^\s\u0020-\u10FF\u2000-\u200D\u2010-\u201F\u2032-\u2037]/gu;
const CHARACTER = /[\s\S]/gu;

/** Markdown and math markup the learner never reads as characters. */
const MARKUP = /\*\*|__|`|\$/gu;
const MATH_COMMAND = /\\[a-z]+/giu;
const MATH_GROUPING = /[{}]/gu;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

export function countScreenCharacters(text: string): number {
  const visible = text
    .replaceAll(MARKUP, "")
    .replaceAll(MATH_COMMAND, "x")
    .replaceAll(MATH_GROUPING, "");

  return countMatches(visible, CHARACTER) + countMatches(visible, DOUBLE_WEIGHT);
}

/**
 * The text as long as the weighted count makes it, markup kept: each character that counts twice
 * appears twice, so a raw length limit measures it the same way.
 */
export function toWeightedText(text: string): string {
  return text.replaceAll(DOUBLE_WEIGHT, "$&$&");
}

/**
 * The cap in the characters a writer in `language` counts: half for a language whose script
 * weighs two, read from the language's own name so it follows the same count.
 */
export function getScreenCharacterLimit(language: string): number {
  const name = new Intl.DisplayNames([language], { type: "language" }).of(language) ?? language;
  const weight = countScreenCharacters(name) / countMatches(name, CHARACTER);

  return Math.floor(MAX_SCREEN_CHARACTERS / weight);
}
