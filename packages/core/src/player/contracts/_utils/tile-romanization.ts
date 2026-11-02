const LATIN_LETTER = /\p{Script=Latin}/u;

/** Never include respelling hints on tiles: inconsistent hints or distractor hints can reveal the answer. Latin words need no romanization. */
export function getTileRomanization({
  romanization,
  word,
}: {
  romanization: string | null;
  word: string;
}): string | null {
  return LATIN_LETTER.test(word) ? null : romanization;
}
