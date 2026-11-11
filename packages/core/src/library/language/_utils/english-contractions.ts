const ENGLISH_CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bcan't\b/gu, "can not"],
  [/\bwon't\b/gu, "will not"],
  [/n't\b/gu, " not"],
  [/'re\b/gu, " are"],
  [/'ve\b/gu, " have"],
  [/'m\b/gu, " am"],
  [/'ll\b/gu, " will"],
  [/'s\b/gu, " 's"],
  [/'d\b/gu, " 'd"],
];

/** Their long form depends on the sentence: "what's" is "what is" or "what has". */
const LONG_FORMS: Readonly<Record<string, readonly string[]>> = {
  "'d": ["would", "had"],
  "'s": ["is", "has"],
};

export function expandContractions({ language, text }: { language: string; text: string }): string {
  if (!language.startsWith("en")) {
    return text;
  }

  return ENGLISH_CONTRACTIONS.reduce(
    (expanded, [pattern, replacement]) => expanded.replaceAll(pattern, replacement),
    text,
  );
}

function isLongFormOf(short: string, long: string): boolean {
  return LONG_FORMS[short]?.includes(long) ?? false;
}

export function isSameSpokenWord(expected: string, heard: string): boolean {
  return expected === heard || isLongFormOf(expected, heard) || isLongFormOf(heard, expected);
}

/** Puts an 's or 'd back on the word it was split from. */
export function joinContractions(text: string): string {
  return text.replaceAll(/ (?='[ds]\b)/gu, "");
}
