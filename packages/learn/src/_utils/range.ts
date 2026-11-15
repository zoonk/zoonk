"use client";

import { useExtracted } from "next-intl";

/**
 * A range written one way on every screen, with the language's own dash: "450–570". Its ends come
 * already written (a score, a percent, a level), and equal ends read as one value.
 */
export function useFormatRange() {
  const t = useExtracted();

  return (low: string, high: string): string =>
    low === high ? low : t("{low}–{high}", { high, low });
}
