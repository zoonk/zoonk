import { normalizeString } from "@zoonk/utils/string";

const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

export function toWords(text: string): string[] {
  return normalizeString(text.replaceAll(PUNCTUATION, " ")).split(" ").filter(Boolean);
}
