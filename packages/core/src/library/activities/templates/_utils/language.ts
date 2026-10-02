/**
 * Word and ending rules for the language templates. The player draws tiles and blanks with the
 * same functions the validator and the grader use, so a tile never differs from what is graded.
 */

/** Punctuation and symbols at a word's edges, like "¿", "?", "," or "«". Inner ones (l'eau) stay. */
const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

/**
 * A sentence's tiles: its words without the punctuation around them, in their written case. The
 * sentence's own punctuation isn't a tile, so "¿" before the right verb can't give it away.
 */
export function sentenceTiles(sentence: string): string[] {
  return sentence
    .split(/\s+/u)
    .map((word) => word.replaceAll(EDGE_PUNCTUATION, ""))
    .filter(Boolean);
}

/** How a tile compares: case doesn't count, since a variant can start with another word. */
export function tileKey(tile: string): string {
  return tile.toLocaleLowerCase();
}

/** Built sentences compare by their words, ignoring spacing, case and punctuation. */
export function sentenceKey(sentence: string): string {
  return sentenceTiles(sentence)
    .map((tile) => tileKey(tile))
    .join(" ");
}

/** The punctuation a sentence opens and closes with, like "¿" and "?", to draw around the tiles. */
export function sentenceEdges(sentence: string): { end: string; start: string } {
  const trimmed = sentence.trim();
  const start = /^[\p{P}\p{S}]+/u.exec(trimmed)?.[0] ?? "";
  const end = /[\p{P}\p{S}]+$/u.exec(trimmed)?.[0] ?? "";

  return { end: trimmed.length === start.length ? "" : end, start };
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
