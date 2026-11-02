import { removeAccents } from "@zoonk/utils/string";

const MAX_TERMS = 16;
const MAX_WORDS_PER_TERM = 5;
const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+/gu;

export type SearchTerm = readonly (readonly string[])[];

function toWordSpellings(word: string): string[] {
  const lowercase = word.toLowerCase();
  return [...new Set([lowercase, removeAccents(lowercase)])];
}

function parseTerm(term: string): SearchTerm {
  return (term.match(WORD_PATTERN) ?? [])
    .slice(0, MAX_WORDS_PER_TERM)
    .map((word) => toWordSpellings(word));
}

function getTermKey(term: SearchTerm): string {
  return term.map((spellings) => spellings.at(-1)).join(" ");
}

export function parseSearchTerms(terms: readonly string[]): SearchTerm[] {
  const parsed = terms.map((term) => parseTerm(term)).filter((term) => term.length > 0);
  return [...new Map(parsed.map((term) => [getTermKey(term), term])).values()].slice(0, MAX_TERMS);
}

export function toWordTsQuery(spellings: readonly string[]): string {
  return spellings.length === 1 ? (spellings[0] ?? "") : `(${spellings.join(" | ")})`;
}

export function toTermTsQuery(term: SearchTerm): string {
  return `(${term.map((spellings) => toWordTsQuery(spellings)).join(" & ")})`;
}

export function toTsQuery(terms: readonly SearchTerm[]): string | null {
  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => toTermTsQuery(term)).join(" | ");
}

export function matchesSearchTerms({
  terms,
  text,
}: {
  terms: readonly SearchTerm[];
  text: string;
}): boolean {
  const words = new Set(removeAccents(text.toLowerCase()).match(WORD_PATTERN));

  return terms.some((term) =>
    term.every((spellings) => spellings.some((spelling) => words.has(removeAccents(spelling)))),
  );
}
