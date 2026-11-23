"use client";

import { useExtracted } from "next-intl";

/** A leading minus, as a number format or a deduction writes it. */
const SIGNED = /^[-−]/u;

/**
 * A range written one way on every screen, with the language's own dash: "450–570". Its ends come
 * already written (a score, a percent, a level), and equal ends read as one value. A dash between
 * two signed ends reads as a subtraction ("−0.3–−0.6"), so they're joined in words instead.
 */
export function useFormatRange() {
  const t = useExtracted();

  return (low: string, high: string): string => {
    if (low === high) {
      return low;
    }

    return SIGNED.test(low) || SIGNED.test(high)
      ? t({
          description:
            'A range whose ends carry a minus sign, such as the points language errors take away: "−0.3 to −0.6".',
          message: "{low} to {high}",
          values: { high, low },
        })
      : t("{low}–{high}", { high, low });
  };
}
