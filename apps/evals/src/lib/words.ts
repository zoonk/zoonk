import { normalizeString } from "@zoonk/utils/string";

const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

export function toWords(text: string): string[] {
  return normalizeString(text.replaceAll(PUNCTUATION, " ")).split(" ").filter(Boolean);
}

function toLetters(text: string): string {
  return toWords(text).join("").split("").toSorted().join("");
}

/**
 * Another order of the same words, so one the pipeline drops only because the screen's tiles join
 * two of its words (Japanese phrases) can't be built, which is no flaw of the model's.
 */
export function reordersWords({ order, text }: { order: string; text: string }): boolean {
  return toLetters(order) === toLetters(text);
}
