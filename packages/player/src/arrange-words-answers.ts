import { segmentWords, stripPunctuation } from "@zoonk/utils/string";

const SEQUENCE_SEPARATOR = "\u0000";

/**
 * Normalize one arrange-words token so punctuation, casing, and surrounding whitespace
 * do not create false mismatches between answers that mean the same thing to the user.
 */
function normalizeArrangeWord(word: string): string {
  return stripPunctuation(word).toLowerCase().trim();
}

/**
 * Build one stable key for a word sequence so deduplication and answer matching can
 * both reuse the same comparison logic instead of reimplementing element-by-element checks.
 */
function getSequenceKey(words: string[]): string {
  return words.map((word) => normalizeArrangeWord(word)).join(SEQUENCE_SEPARATOR);
}

/**
 * Segment raw arrange-words text in one shared place so every caller uses the same
 * tokenization rules before it deduplicates, validates, or builds helper data.
 */
function getWordSequence(text: string): string[] {
  return segmentWords(text);
}

/**
 * Treat blank or punctuation-only texts as "no sequence" so they never become
 * accepted answers or pollute derived helper sets.
 */
function hasWords(words: string[]): boolean {
  return words.length > 0;
}

/**
 * Deduplicate accepted sequences by their normalized key while preserving the first
 * original tokenization we saw. That keeps the canonical display words stable.
 */
function deduplicateAcceptedWordSequences(wordSequences: string[][]): string[][] {
  return [
    ...new Map(wordSequences.map((words) => [getSequenceKey(words), words] as const)).values(),
  ];
}

/**
 * Build the accepted arrange-words sequences from the primary text plus alternatives,
 * while ignoring blank entries and deduplicating punctuation/casing variants.
 */
export function buildAcceptedArrangeWordSequences(
  primaryText: string,
  alternatives: string[],
): string[][] {
  return deduplicateAcceptedWordSequences(
    [primaryText, ...alternatives]
      .map((text) => getWordSequence(text))
      .filter((words) => hasWords(words)),
  );
}

/**
 * Collect the distinct accepted sequence lengths so UI helpers can quickly decide which
 * answer lengths are valid without inspecting every full sequence each time.
 */
export function getAcceptedArrangeWordLengths(acceptedWordSequences: string[][]): number[] {
  return [
    ...new Set(
      acceptedWordSequences.filter((words) => hasWords(words)).map((words) => words.length),
    ),
  ].toSorted((left, right) => left - right);
}

/**
 * Compare a user's arranged words against the accepted sequences with the same normalized
 * sequence key used for deduplication. One rule stays easier to reason about than two.
 */
export function matchesAcceptedArrangeWords(
  acceptedWordSequences: string[][],
  userWords: string[],
): boolean {
  const userSequenceKey = getSequenceKey(userWords);

  return acceptedWordSequences.some((words) => getSequenceKey(words) === userSequenceKey);
}
