import { getContentLocale } from "@zoonk/utils/locale";

/** Satori breaks Korean inside words, as browsers do; Korean wraps at the spaces between them. */
export function getOpenGraphWordBreak(language: string): "keep-all" | "normal" {
  return getContentLocale(language) === "ko" ? "keep-all" : "normal";
}
