import { normalizeString } from "./string";

const CONNECTORS = new Set([
  "a",
  "and",
  "da",
  "das",
  "de",
  "del",
  "der",
  "des",
  "die",
  "do",
  "dos",
  "du",
  "e",
  "el",
  "en",
  "et",
  "for",
  "ihre",
  "in",
  "its",
  "la",
  "las",
  "le",
  "les",
  "los",
  "of",
  "sua",
  "suas",
  "sus",
  "the",
  "their",
  "und",
  "y",
]);

const MIN_PREFIX = 4;

const MIN_VARIANT_LENGTH = 5;

const LETTERS_PER_CHANGE = 3;

export function toNameWords(name: string): string[] {
  return normalizeString(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !CONNECTORS.has(word));
}

export function isSameNameWord(first: string, second: string): boolean {
  if (first === second) {
    return true;
  }

  const [short, long] = first.length <= second.length ? [first, second] : [second, first];
  return short.length >= MIN_PREFIX && long.startsWith(short);
}

function countEdits(first: string, second: string): number {
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let row = 0; row < first.length; row += 1) {
    const current = [row + 1];

    for (let column = 0; column < second.length; column += 1) {
      const replaced = (previous[column] ?? 0) + (first[row] === second[column] ? 0 : 1);
      const removed = (previous[column + 1] ?? 0) + 1;
      const added = (current[column] ?? 0) + 1;

      current.push(Math.min(replaced, removed, added));
    }

    previous = current;
  }

  return previous.at(-1) ?? 0;
}

function isSpellingVariant(first: string, second: string): boolean {
  if (Math.min(first.length, second.length) < MIN_VARIANT_LENGTH) {
    return false;
  }

  return countEdits(first, second) * LETTERS_PER_CHANGE <= Math.max(first.length, second.length);
}

/**
 * Every meaningful word of the shorter name must have its word in the longer one: the same,
 * shortened, or spelled the other language's way.
 */
export function namesMatchAcrossSpellings(first: string, second: string): boolean {
  const firstWords = toNameWords(first);
  const secondWords = toNameWords(second);

  if (firstWords.length === 0 || secondWords.length === 0) {
    return false;
  }

  const [shorter, longer] =
    firstWords.length <= secondWords.length ? [firstWords, secondWords] : [secondWords, firstWords];

  return shorter.every((word) =>
    longer.some((other) => isSameNameWord(word, other) || isSpellingVariant(word, other)),
  );
}
