import { normalizeString, stripPunctuation } from "@zoonk/utils/string";

/** Words this short ("of", "a") are in almost everything, so a query's are left out; numbers stay. */
const MIN_WORD_LENGTH = 3;

/** Text as a lookup compares it: no accents, case or punctuation ("Lei nº 8.112" reads "lei nº 8112"). */
function toSearchText(text: string): string {
  return stripPunctuation(normalizeString(text));
}

/** Whether `text` has every word of the buddy's query; an empty query matches everything. */
export function matchesQuery({ query, text }: { query: string; text: string }): boolean {
  const words = toSearchText(query)
    .split(" ")
    .filter((word) => word.length >= MIN_WORD_LENGTH || /\d/u.test(word));

  const searched = toSearchText(text);

  return words.every((word) => searched.includes(word));
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
