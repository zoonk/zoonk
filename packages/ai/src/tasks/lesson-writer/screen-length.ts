/**
 * A tweet: what a lesson screen aims to ask the learner to read at once, at every level. It's a
 * target the prompts ask for, never a cut-off: a clear screen that runs over is kept as written.
 */
const SCREEN_CHARACTERS = 250;

/**
 * Twitter's weighted length: Latin, Greek, Cyrillic, Arabic, Hebrew, Indic scripts and general
 * punctuation count once, and every other character (Chinese, Japanese, Korean, emoji) twice, since
 * one of them carries about as much as two letters.
 */
const DOUBLE_WEIGHT = /[^\s -ჿ -‍‐-‟′-‷]/gu;
const CHARACTER = /[\s\S]/gu;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * The target in the characters a writer in `language` counts: half for a language whose script
 * weighs two, read from the language's own name so it follows the same count.
 */
export function getScreenCharacterTarget(language: string): number {
  const name = new Intl.DisplayNames([language], { type: "language" }).of(language) ?? language;
  const characters = countMatches(name, CHARACTER);
  const weight = (characters + countMatches(name, DOUBLE_WEIGHT)) / characters;

  return Math.floor(SCREEN_CHARACTERS / weight);
}
