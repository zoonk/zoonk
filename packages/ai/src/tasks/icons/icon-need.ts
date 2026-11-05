import { replaceEmDashes } from "@zoonk/utils/string";

/** What a screen or an idea asks the shared icon library for, in English. */
export type IconNeed = { description: string; name: string; searchWords: string[] };

const MAX_NAME_WORDS = 4;
const MAX_SEARCH_WORDS = 5;
const MAX_DESCRIPTION_LENGTH = 200;
const ENGLISH_WORDS = /^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*)*$/u;
const LEADING_ARTICLE = /^(?:an?|the) /u;

/**
 * Lowercase English words, so a name is the same key whoever wrote it. Null for anything else:
 * digits, another script or a long phrase can't be a shared icon's name.
 */
export function normalizeIconName(name: string): string | null {
  const cleaned = name
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll(/[.,;:!?"“”()]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .replace(LEADING_ARTICLE, "");

  const words = cleaned.split(" ").length;

  return ENGLISH_WORDS.test(cleaned) && words <= MAX_NAME_WORDS ? cleaned : null;
}

export function toIconNeed(
  need: { description: string; name: string; searchWords: readonly string[] } | null | undefined,
): IconNeed | null {
  const name = need ? normalizeIconName(need.name) : null;

  if (!need || !name) {
    return null;
  }

  const searchWords = [
    ...new Set(need.searchWords.flatMap((word) => normalizeIconName(word) ?? [])),
  ].filter((word) => word !== name);

  const description = replaceEmDashes(need.description.trim()).slice(0, MAX_DESCRIPTION_LENGTH);

  return {
    description: description || name,
    name,
    searchWords: searchWords.slice(0, MAX_SEARCH_WORDS),
  };
}
