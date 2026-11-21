"use client";

import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted, useFormatter } from "next-intl";
import { daysBetween, useFormatIsoDate, useIsoToday } from "../_utils/iso-date";
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

type Range = { high: number; low: number };

/** A deduction's minus: the typographic one, which a hyphen only imitates. */
const MINUS = "\u2212";

/** 0.3 × 10 is 3.0000000000000004 in floating point, which must still round to 3. */
const FLOAT_SLACK = 1e-9;

/**
 * A headline range rounded outward to `decimals`, its low end down and its high end up, so it never
 * claims more than its parts. Zero stays zero, never "−0".
 */
export function roundOutward({ high, low }: Range, decimals: number): Range {
  const step = 10 ** decimals;

  return {
    high: Math.ceil(high * step - FLOAT_SLACK) / step || 0,
    low: Math.floor(low * step + FLOAT_SLACK) / step || 0,
  };
}

/** Exactly `decimals` digits after the point, so every number of one scale reads alike. */
export function fixedDecimals(decimals: number) {
  return { maximumFractionDigits: decimals, minimumFractionDigits: decimals };
}

/**
 * A range of points, one number when both ends round alike ("29.8", never "29.79–29.8"), and both
 * ends with the same decimals ("12.0–17.5", never "12–17.5"): the scale's own (`decimals`) when the
 * server sends them, else what the values need. A deduction carries its minus on each end, the
 * smaller first: "−0.3 to −0.6". A `headline` rounds its low end down and its high end up, so it
 * never claims more than its parts.
 */
export function useFormatPointsRange() {
  const format = useFormatter();
  const formatRange = useFormatRange();

  return (
    { high, low }: Range,
    {
      decimals: scaleDecimals,
      deduction = false,
      headline = false,
    }: { decimals?: number; deduction?: boolean; headline?: boolean } = {},
  ): string => {
    const decimals =
      scaleDecimals ?? ([low, high].some((value) => Math.round(value * 10) % 10 !== 0) ? 1 : 0);

    const options = fixedDecimals(decimals);

    const end = (value: number) => {
      const written = format.number(value, options);
      return deduction && value > 0 ? `${MINUS}${written}` : written;
    };

    const shown = headline ? roundOutward({ high, low }, decimals) : { high, low };
    return formatRange(end(shown.low), end(shown.high));
  };
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
