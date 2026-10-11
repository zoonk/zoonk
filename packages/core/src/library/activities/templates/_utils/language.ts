/**
 * Word and ending rules for language content. The player draws blanks with the same functions the
 * validator and the grader use, so a blank never differs from what is graded.
 */

/** Punctuation and symbols at a word's edges, like "¿", "?", "," or "«". Inner ones (l'eau) stay. */
const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

/** A sentence's words without the punctuation around them, in their written case. */
function sentenceWords(sentence: string): string[] {
  return sentence
    .split(/\s+/u)
    .map((word) => word.replaceAll(EDGE_PUNCTUATION, ""))
    .filter(Boolean);
}

/** Sentences compare by their words, ignoring spacing, case and punctuation. */
export function sentenceKey(sentence: string): string {
  return sentenceWords(sentence)
    .map((word) => word.toLocaleLowerCase())
    .join(" ");
}

/**
 * The ending a pattern table's blank needs: the longest offered ending its answer finishes with,
 * so "emos" wins over "os" for "comemos". Null when no ending fits.
 */
export function patternEnding(choices: readonly string[], answer: string): string | null {
  return (
    choices
      .filter((choice) => answer.endsWith(choice))
      .toSorted((a, b) => b.length - a.length)[0] ?? null
  );
}
