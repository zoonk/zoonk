const LATIN_LETTER = /\p{Script=Latin}/u;

/**
 * What an answer tile (a word-bank word, a translation option) shows under its word: the
 * romanization of a word in a non-Latin script, so it can be read, and nothing for a word already
 * in Latin letters. Tiles never carry respelling hints ("BÉ-frum"): a hint on some tiles, or on a
 * distractor, would give answers away.
 */
export function getTileRomanization({
  romanization,
  word,
}: {
  romanization: string | null;
  word: string;
}): string | null {
  return LATIN_LETTER.test(word) ? null : romanization;
}
