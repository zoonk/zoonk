import { isSameNameWord, toNameWords } from "@zoonk/utils/name-words";

/** Every meaningful word of the shorter name appears in the longer one, as `same` compares them. */
function hasEveryWord({
  first,
  same,
  second,
}: {
  first: string;
  same: (word: string, other: string) => boolean;
  second: string;
}): boolean {
  const firstWords = toNameWords(first);
  const secondWords = toNameWords(second);

  if (firstWords.length === 0 || secondWords.length === 0) {
    return false;
  }

  const [shorter, longer] =
    firstWords.length <= secondWords.length ? [firstWords, secondWords] : [secondWords, firstWords];

  return shorter.every((word) => longer.some((other) => same(word, other)));
}

/**
 * Whether two names for an exam area mean the same area: every meaningful word of the shorter
 * name appears in the longer one, allowing short forms. "Math" matches "Mathematics and its
 * Technologies" and a section "Natural Sciences and Math", but "Natural Sciences" doesn't match
 * "Languages, Humanities and essay".
 */
export function namesMatch(first: string, second: string): boolean {
  return hasEveryWord({ first, same: isSameNameWord, second });
}

/**
 * Whether two names match word for word, with no word standing for a longer one: "Languages"
 * matches "Languages, Codes and their Technologies" in full, but "Language Arts" only by a
 * shortened word. A word that only begins another can be a different subject's.
 */
export function namesMatchInFull(first: string, second: string): boolean {
  return hasEveryWord({ first, same: (word, other) => word === other, second });
}

/**
 * How much of the shorter name the longer one shares, from 0 to 1, for names that almost match:
 * "Legislative Process and Parliamentary Rules" shares three of its four words with the
 * notice's "Legislative Process and Internal Rules of the Chamber of Deputies". 1 when `namesMatch`.
 */
export function nameOverlap(first: string, second: string): number {
  const firstWords = toNameWords(first);
  const secondWords = toNameWords(second);

  if (firstWords.length === 0 || secondWords.length === 0) {
    return 0;
  }

  const [shorter, longer] =
    firstWords.length <= secondWords.length ? [firstWords, secondWords] : [secondWords, firstWords];

  const shared = shorter.filter((word) => longer.some((other) => isSameNameWord(word, other)));
  return shared.length / shorter.length;
}

/**
 * The exam's sections a subject or area belongs to, by their names: the ones that name it in full
 * (`namesMatch`), or else the one section that shares the most of its words. An exam day's section
 * lists its subjects by part of their official names, as ENEM's "Natural Sciences and
 * Mathematics" names "Mathematics and its Technologies". A name two sections share as much of, or none
 * of, belongs to none.
 */
export function findNamingSections({
  name,
  sections,
}: {
  name: string;
  sections: readonly string[];
}): string[] {
  const named = sections.filter((section) => namesMatch(name, section));

  if (named.length > 0) {
    return named;
  }

  const scores = sections.map((section) => nameOverlap(name, section));
  const best = Math.max(0, ...scores);
  const top = sections.filter((_section, index) => scores[index] === best);

  return best > 0 && top.length === 1 ? top : [];
}
