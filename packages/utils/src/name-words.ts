import { normalizeString } from "./string";

/**
 * Connecting words in the five app languages. Official names wrap an area in them ("Mathematics
 * and its Technologies", "Natural Sciences and its Technologies"), so they never decide a match.
 */
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

/** A shortened word ("Math") matches the word it starts ("Mathematics") from this length on. */
const MIN_PREFIX = 4;

/** Shorter words differ too little to tell another language's spelling from another word. */
const MIN_VARIANT_LENGTH = 5;

/** At most one letter in this many may differ between two spellings of one word. */
const LETTERS_PER_CHANGE = 3;

/** The meaningful words of a subject or area name, normalized, without connecting words. */
export function toNameWords(name: string): string[] {
  return normalizeString(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !CONNECTORS.has(word));
}

/** The same word, or a shortened one ("math") and the word it starts ("mathematics"). */
export function isSameNameWord(first: string, second: string): boolean {
  if (first === second) {
    return true;
  }

  const [short, long] = first.length <= second.length ? [first, second] : [second, first];
  return short.length >= MIN_PREFIX && long.startsWith(short);
}

/** The fewest letters to add, remove or change to turn one word into the other. */
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

/**
 * Two normalized words that are one word spelled in two languages ("expressao" and "expresion",
 * "leitura" and "lectura"): long enough, with at most a third of the letters changed.
 */
function isSpellingVariant(first: string, second: string): boolean {
  if (Math.min(first.length, second.length) < MIN_VARIANT_LENGTH) {
    return false;
  }

  return countEdits(first, second) * LETTERS_PER_CHANGE <= Math.max(first.length, second.length);
}

/**
 * Whether two names say the same subject in two languages' spelling: every meaningful word of the
 * shorter name has its word in the longer one, the same, shortened, or spelled the other language's
 * way ("Expressão e interação escritas" and DELE's "Expresión e interacción escritas").
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
