"use client";

import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";

type Fields = ActivityContentFor<"samplingSimulator">["fields"];

const PERCENT = 100;
const SHARE_DIGITS = 1;

/**
 * Results in the population's terms: shares as percents with margins in percentage points
 * ("±3 points"), averages in their unit ("±2.1 cm").
 */
export function useSamplingFormat(fields: Fields) {
  const t = useExtracted();
  const format = useFormatNumber();
  const isShare = fields.population.kind === "proportion";

  function formatValue(value: number, digits?: number): string {
    return isShare
      ? format(value * PERCENT, { maximumFractionDigits: digits ?? SHARE_DIGITS, unit: "%" })
      : format(value, { maximumFractionDigits: digits, unit: fields.unit });
  }

  function formatMargin(margin: number): string {
    return isShare
      ? t("±{value} points", {
          value: format(margin * PERCENT, { maximumFractionDigits: SHARE_DIGITS }),
        })
      : t("±{value}", { value: format(margin, { unit: fields.unit }) });
  }

  return { format, formatMargin, formatSize: (size: number) => format(size), formatValue };
}
