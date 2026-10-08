import { normalizeString } from "@zoonk/utils/string";

/** Words only: punctuation and spacing don't change what a phrase says. */
function toWords(text: string): string {
  return ` ${normalizeString(text)
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}

/**
 * Whether the goal's title already says this fact, as whole words regardless of accents and case
 * ("Câmara dos Deputados" in "Passar no concurso da Câmara dos Deputados"), so the card doesn't
 * repeat it on a row of its own. A fact inside a longer word ("dev" in "development") isn't said.
 */
export function isSaidInTitle({ title, value }: { title: string; value: string }): boolean {
  const words = toWords(value);
  return words.trim().length > 0 && toWords(title).includes(words);
}
