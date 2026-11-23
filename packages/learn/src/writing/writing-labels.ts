"use client";

import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted, useFormatter } from "next-intl";
import { daysBetween, useFormatIsoDate, useIsoToday } from "../_utils/iso-date";
import { useFormatRange } from "../_utils/range";
import { formatPointsRange } from "./format-points-range";

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

export function useFormatPointsRange() {
  const { number } = useFormatter();
  const joinDeduction = useFormatRange();

  return (
    range: Parameters<typeof formatPointsRange>[0]["range"],
    options: Pick<Parameters<typeof formatPointsRange>[0], "decimals" | "kind">,
  ): string => formatPointsRange({ joinDeduction, number, range, ...options });
}

/**
 * The one line a row shows when the day's grading is used up, under the row it limits: "Back
 * tomorrow: no more grading today", or the day it returns when that's later.
 */
export function useGradingReturnsLine() {
  const t = useExtracted();
  const today = useIsoToday();
  const formatDate = useFormatIsoDate();

  return (returnsOn: string): string =>
    daysBetween(today, returnsOn) <= 1
      ? t("Back tomorrow: no more grading today")
      : t("Back on {date}: no more grading today", { date: formatDate(returnsOn, "sentence") });
}
