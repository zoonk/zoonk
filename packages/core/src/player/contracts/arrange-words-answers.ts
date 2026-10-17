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
 * Build one stable key for a word sequence so answer matching compares normalized words
 * instead of reimplementing element-by-element checks.
 */
function getSequenceKey(words: string[]): string {
  return words.map((word) => normalizeArrangeWord(word)).join(SEQUENCE_SEPARATOR);
}

/**
 * Build the accepted arrange-words sequences from the sentence. A blank or punctuation-only
 * sentence has no sequence, so it never becomes an accepted answer.
 */
export function buildAcceptedArrangeWordSequences(text: string): string[][] {
  const words = segmentWords(text);
  return words.length > 0 ? [words] : [];
}

/**
 * Collect the accepted sequence lengths so UI helpers can quickly decide which answer
 * lengths are valid without inspecting every full sequence each time.
 */
export function getAcceptedArrangeWordLengths(acceptedWordSequences: string[][]): number[] {
  return acceptedWordSequences.map((words) => words.length);
}

/**
 * Compare a user's arranged words against the accepted sequences by their normalized
 * sequence key, so punctuation and casing never decide the answer.
 */
export function matchesAcceptedArrangeWords(
  acceptedWordSequences: string[][],
  userWords: string[],
): boolean {
  const userSequenceKey = getSequenceKey(userWords);

  return acceptedWordSequences.some((words) => getSequenceKey(words) === userSequenceKey);
}
