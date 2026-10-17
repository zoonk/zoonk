import { removeAccents } from "@zoonk/utils/string";

/** Enough terms for the item's own words plus the model's, without a runaway query. */
const MAX_TERMS = 16;
/** A term is a short phrase; longer ones would only match items that repeat it word for word. */
const MAX_WORDS_PER_TERM = 5;
const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+/gu;

/**
 * One search term: every word must appear in the item. Each word lists its
 * spellings with and without accents, because stored titles and descriptions
 * keep their accents while model terms and normalized titles may not.
 */
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

/** The accentless spelling, so "Função" and "funcao" count as one term. */
function getTermKey(term: SearchTerm): string {
  return term.map((spellings) => spellings.at(-1)).join(" ");
}

/**
 * Turns free-text terms into words only. Everything else is dropped, so a term
 * can never inject text-search operators, and terms that repeat after
 * normalization are searched once.
 */
export function parseSearchTerms(terms: readonly string[]): SearchTerm[] {
  const parsed = terms.map((term) => parseTerm(term)).filter((term) => term.length > 0);
  return [...new Map(parsed.map((term) => [getTermKey(term), term])).values()].slice(0, MAX_TERMS);
}

/** A `to_tsquery` expression for one word of a term, in any of its spellings. */
export function toWordTsQuery(spellings: readonly string[]): string {
  return spellings.length === 1 ? (spellings[0] ?? "") : `(${spellings.join(" | ")})`;
}

/** A `to_tsquery` expression that matches an item containing every word of one term. */
export function toTermTsQuery(term: SearchTerm): string {
  return `(${term.map((spellings) => toWordTsQuery(spellings)).join(" & ")})`;
}

/**
 * Builds a `to_tsquery` expression that matches an item containing every word
 * of at least one term. Returns null when no term has a word, so callers skip
 * the query instead of matching nothing.
 */
export function toTsQuery(terms: readonly SearchTerm[]): string | null {
  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => toTermTsQuery(term)).join(" | ");
}

/**
 * The same rule as the database query, on whole words and without stemming.
 * Stemming only adds matches, so evals that use this measure a lower bound of
 * what the database finds.
 */
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
