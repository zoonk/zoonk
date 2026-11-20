"use client";

import { useExtracted, useFormatter } from "next-intl";

/** A quoted passage: a rule at its start, then the text, the same gap wherever the essay quotes. */
export const ESSAY_QUOTE_CLASS = "border-l-2 pl-3";

/** The box an essay is written in: reading size at every width, since it holds long text. */
export const ESSAY_FIELD_CLASS = "min-h-72 text-base leading-relaxed md:text-base";

export function useFormatScore() {
  const format = useFormatter();
  return (value: number): string => format.number(value, { maximumFractionDigits: 2 });
}

export function useWritingName() {
  const t = useExtracted();
  return (rubric: string): string => (rubric === "enem" ? t("Your essay") : t("Your answer"));
}
