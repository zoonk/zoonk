"use client";

import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatRange } from "../_utils/range";

export type WritingLevel = WritingResult["criteria"][number]["level"];

/** How many of a level meter's four cells each level fills. */
export const LEVEL_CELLS: Record<WritingLevel, number> = {
  complete: 4,
  missing: 0,
  partial: 2,
  strong: 3,
};

export const LEVEL_CELL_COUNT = 4;

export function useLevelName() {
  const t = useExtracted();

  return (level: WritingLevel): string => {
    switch (level) {
      case "complete":
        return t({
          description: "A criterion of a written answer fully met.",
          message: "Complete",
        });
      case "strong":
        return t({ description: "A criterion of a written answer mostly met.", message: "Good" });
      case "partial":
        return t({ description: "A criterion of a written answer half met.", message: "Partly" });
      case "missing":
        return t({ description: "A criterion of a written answer not met.", message: "Missing" });
      default:
        return level satisfies never;
    }
  };
}

/**
 * A range of points, one number when both ends round alike ("29.8", never "29.79–29.8"), and both
 * ends with the same decimals ("12.0–17.5", never "12–17.5").
 */
export function useFormatPointsRange() {
  const format = useFormatter();
  const formatRange = useFormatRange();

  return ({ high, low }: { high: number; low: number }): string => {
    const decimals = [low, high].some((value) => Math.round(value * 10) % 10 !== 0) ? 1 : 0;
    const options = { maximumFractionDigits: decimals, minimumFractionDigits: decimals };

    return formatRange(format.number(low, options), format.number(high, options));
  };
}
