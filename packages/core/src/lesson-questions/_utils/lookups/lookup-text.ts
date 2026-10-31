import { normalizeString, stripPunctuation } from "@zoonk/utils/string";

const MIN_WORD_LENGTH = 3;

function toSearchText(text: string): string {
  return stripPunctuation(normalizeString(text));
}

/** Empty queries match all; short-word-only queries require whole words rather than matching everything. */
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

export function matchesArea({ area, names }: { area: string; names: readonly string[] }): boolean {
  const wanted = toSearchText(area);

  return names.some((name) => {
    const candidate = toSearchText(name);
    return candidate.includes(wanted) || wanted.includes(candidate);
  });
}
