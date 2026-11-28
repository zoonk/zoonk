"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { type FinishForecast } from "./finish-readout";

export function useFormatFinishDate() {
  const formatDate = useFormatIsoDate();

  return (endDate: string, precision: FinishForecast["precision"] | "day"): string => {
    if (precision === "year") {
      return formatDate(endDate, "year");
    }

    return formatDate(endDate, precision === "day" ? "sentence" : "sentenceMonth", {
      year: "always",
    });
  };
}

/** When a plan that studies past its exam finishes, in one sentence. */
export function useFinishSentence() {
  const t = useExtracted();
  const formatDate = useFormatFinishDate();

  return ({ endDate, precision }: { endDate: string; precision: FinishForecast["precision"] }) =>
    t({
      description: '{date} is a month and year, like "January 2027", or a year, like "2031".',
      message: "You finish around {date}.",
      values: { date: formatDate(endDate, precision) },
    });
}
