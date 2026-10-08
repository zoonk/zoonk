import { normalizeString } from "@zoonk/utils/string";

/**
 * Connecting words in the five app languages. Official names wrap an area in them ("Mathematics
 * and its Technologies", "Ciências da Natureza e suas Tecnologias"), so they never decide a match.
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

function toWords(name: string): string[] {
  return normalizeString(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !CONNECTORS.has(word));
}

function isSameWord(first: string, second: string): boolean {
  if (first === second) {
    return true;
  }

  const [short, long] = first.length <= second.length ? [first, second] : [second, first];
  return short.length >= MIN_PREFIX && long.startsWith(short);
}

/**
 * Whether two names for an exam area mean the same area: every meaningful word of the shorter
 * name appears in the longer one, allowing short forms. "Math" matches "Mathematics and its
 * Technologies" and a section "Natural Sciences and Math", but "Natural Sciences" doesn't match
 * "Languages, Humanities and essay".
 */
export function namesMatch(first: string, second: string): boolean {
  const firstWords = toWords(first);
  const secondWords = toWords(second);

  if (firstWords.length === 0 || secondWords.length === 0) {
    return false;
  }

  const [shorter, longer] =
    firstWords.length <= secondWords.length ? [firstWords, secondWords] : [secondWords, firstWords];

  return shorter.every((word) => longer.some((other) => isSameWord(word, other)));
}

/**
 * How much of the shorter name the longer one shares, from 0 to 1, for names that almost match:
 * "Processo Legislativo e Regimentos Parlamentares" shares three of its four words with the
 * notice's "Processo Legislativo e Regimento Interno da Câmara dos Deputados". 1 when `namesMatch`.
 */
export function nameOverlap(first: string, second: string): number {
  const firstWords = toWords(first);
  const secondWords = toWords(second);

  if (firstWords.length === 0 || secondWords.length === 0) {
    return 0;
  }

  const [shorter, longer] =
    firstWords.length <= secondWords.length ? [firstWords, secondWords] : [secondWords, firstWords];

  const shared = shorter.filter((word) => longer.some((other) => isSameWord(word, other)));
  return shared.length / shorter.length;
}
