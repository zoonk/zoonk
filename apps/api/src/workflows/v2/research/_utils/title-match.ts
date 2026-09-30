import { removeAccents } from "@zoonk/utils/string";

/** Words this short ("de", "nº", "of") appear in every title. */
const MIN_WORD_LENGTH = 3;
const MIN_SHARED_WORDS = 0.6;
const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

function toWords(title: string): Set<string> {
  const words = removeAccents(title.toLowerCase()).match(WORD_PATTERN) ?? [];
  return new Set(words.filter((word) => word.length >= MIN_WORD_LENGTH));
}

/**
 * Whether a search result is the same document as an upload: most words of the
 * shorter title appear in the other. Titles on a publisher's page and on the
 * document's cover rarely match exactly.
 */
export function isSameDocumentTitle({
  found,
  uploaded,
}: {
  found: string;
  uploaded: string;
}): boolean {
  const foundWords = toWords(found);
  const uploadedWords = toWords(uploaded);
  const smaller = foundWords.size <= uploadedWords.size ? foundWords : uploadedWords;
  const larger = smaller === foundWords ? uploadedWords : foundWords;

  if (smaller.size === 0) {
    return false;
  }

  const shared = [...smaller].filter((word) => larger.has(word)).length;

  return shared / smaller.size >= MIN_SHARED_WORDS;
}
