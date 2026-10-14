import { normalizeString, stripPunctuation } from "@zoonk/utils/string";

/** Words this short ("of", "a") are in almost everything, so a query's are left out; numbers stay. */
const MIN_WORD_LENGTH = 3;

/** Text as a lookup compares it: no accents, case or punctuation ("Lei nº 8.112" reads "lei nº 8112"). */
function toSearchText(text: string): string {
  return stripPunctuation(normalizeString(text));
}

/**
 * Whether `text` has every word of the buddy's query, short ones aside; an empty query matches
 * everything. A query of short words only ("Go", "C", "AI") names them: each must be a whole word
 * of the text, so it never matches everything.
 */
export function matchesQuery({ query, text }: { query: string; text: string }): boolean {
  const words = toSearchText(query).split(/\s+/u).filter(Boolean);
  const long = words.filter((word) => word.length >= MIN_WORD_LENGTH || /\d/u.test(word));
  const searched = toSearchText(text);

  if (long.length > 0 || words.length === 0) {
    return long.every((word) => searched.includes(word));
  }

  const textWords = new Set(searched.split(/\s+/u));
  return words.every((word) => textWords.has(word));
}

/**
 * Whether one of `names` is the subject the buddy named: the same words, or one inside the other
 * ("Constitutional" and "Basics of Constitutional Law and Internal Rules").
 */
export function matchesArea({ area, names }: { area: string; names: readonly string[] }): boolean {
  const wanted = toSearchText(area);

  return names.some((name) => {
    const candidate = toSearchText(name);
    return candidate.includes(wanted) || wanted.includes(candidate);
  });
}
