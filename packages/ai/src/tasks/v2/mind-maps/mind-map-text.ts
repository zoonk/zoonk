/**
 * The share of the map's words a picture may seem to leave out before it fails. A reader of the
 * picture (the vision model) now and then skips a word or a short line it did see; a picture that
 * dropped a branch leaves out far more than this.
 */
const MAX_MISSING_SHARE = 0.04;

/**
 * Wrong words a picture may have before it's redrawn: a slip or two (a swapped letter, a word on a
 * sketch) still reads fine, while garbled or misspelled text shows many more.
 */
const MAX_UNKNOWN_WORDS = 2;

const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{M}]+)*/gu;
const DIGITS_PATTERN = /^\p{N}+$/u;

/** Lowercase words with their accents, so "eletrica" never passes for "elétrica". */
function toWords(text: string): string[] {
  const normalized = text
    .normalize("NFC")
    .toLocaleLowerCase()
    .replaceAll(/[’‘`´]/gu, "'");

  return normalized.match(WORD_PATTERN) ?? [];
}

/** Numbers alone and single characters, which a picture's sketches add or drop without harm. */
function isMarkLike(word: string): boolean {
  return word.length <= 1 || DIGITS_PATTERN.test(word);
}

/**
 * Words the picture shows that the map doesn't have. A word broken across two lines ("eletrici-",
 * "dade") counts as the whole word. Numbers alone and single characters are left out: they are a
 * sketch's dial or a stray mark, never a misspelled word a learner would read.
 */
function findUnknownWords({
  expected,
  shown,
}: {
  expected: ReadonlySet<string>;
  shown: readonly string[];
}): string[] {
  const joined = new Set(
    shown.flatMap((word, index) => {
      const next = shown[index + 1];
      return next && expected.has(`${word}${next}`) ? [index, index + 1] : [];
    }),
  );

  return shown.filter(
    (word, index) => !expected.has(word) && !joined.has(index) && !isMarkLike(word),
  );
}

export type MindMapTextComparison = {
  /** Words of the map the picture doesn't show, distinct. */
  missing: string[];
  /** Words the picture shows that the map doesn't have: misspelled, garbled or invented, distinct. */
  unknown: string[];
  passed: boolean;
};

/**
 * Compares the text read from a mind map's picture with the texts it was asked to letter, word by
 * word, accents included. It passes unless the problem is serious: more than a couple of words that
 * aren't the map's, or more than a few of the map's words missing (a part left out).
 */
export function compareMindMapText({
  expected,
  transcript,
}: {
  /** Every text the picture should letter (`listMindMapTexts`). */
  expected: readonly string[];
  /** Every text read from the picture, as written. */
  transcript: readonly string[];
}): MindMapTextComparison {
  const expectedWords = new Set(expected.flatMap((text) => toWords(text)));
  const shown = transcript.flatMap((text) => toWords(text));
  const shownSet = new Set(shown);

  const unknown = [...new Set(findUnknownWords({ expected: expectedWords, shown }))];

  const missing = [...expectedWords].filter(
    (word) =>
      !isMarkLike(word) &&
      !shownSet.has(word) &&
      !shown.some((part, index) => `${part}${shown[index + 1] ?? ""}` === word),
  );

  const wordCount = [...expectedWords].filter((word) => !isMarkLike(word)).length;
  const missingShare = wordCount === 0 ? 0 : missing.length / wordCount;

  return {
    missing,
    passed: unknown.length <= MAX_UNKNOWN_WORDS && missingShare <= MAX_MISSING_SHARE,
    unknown,
  };
}
