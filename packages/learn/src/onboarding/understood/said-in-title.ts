import { normalizeString } from "@zoonk/utils/string";

function toWords(text: string): string {
  return ` ${normalizeString(text)
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}

/** As whole words, ignoring accents and case: "dev" isn't said in "development". */
export function isSaidInTitle({ title, value }: { title: string; value: string }): boolean {
  const words = toWords(value);
  return words.trim().length > 0 && toWords(title).includes(words);
}
