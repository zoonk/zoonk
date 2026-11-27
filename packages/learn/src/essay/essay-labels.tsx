"use client";

import { useFormatter } from "next-intl";
import { formatFixedPoints } from "../writing/format-points-range";

/** A quoted passage: a rule at its start, then the text, the same gap wherever the essay quotes. */
export const ESSAY_QUOTE_CLASS = "border-l-2 pl-3";

/** The box an essay is written in: reading size at every width, since it holds long text. */
/**
 * A written answer's field holds focus for the whole answer, so its focus is a soft line, as the
 * lesson's question composer draws it; the usual ring returns with more contrast.
 */
export const ESSAY_FIELD_CLASS =
  "min-h-72 text-base leading-relaxed md:text-base focus-visible:border-foreground/35 focus-visible:ring-0 contrast-more:focus-visible:border-ring contrast-more:focus-visible:ring-[3px]";

export function useFormatScore() {
  const format = useFormatter();
  return (value: number): string => formatFixedPoints(value, format.number);
}
