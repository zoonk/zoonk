import { isSameNameWord, toNameWords } from "@zoonk/utils/name-words";

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

/** Allows shortened words; use `namesMatchInFull` when prefix matches are not acceptable. */
export function namesMatch(first: string, second: string): boolean {
  return hasEveryWord({ first, same: isSameNameWord, second });
}

export function namesMatchInFull(first: string, second: string): boolean {
  return hasEveryWord({ first, same: (word, other) => word === other, second });
}

/** Returns the fraction of the shorter name shared with the longer one, from 0 to 1. */
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
