"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";

/**
 * When the learner finishes, in one sentence wherever it shows. A language plan ends where its aim
 * is, so with an `aim` it says when they reach it.
 */
export function useFinishSentence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();

  return ({
    aim = null,
    endDate,
    minutes = null,
  }: {
    aim?: string | null;
    endDate: string;
    minutes?: number | null;
  }): string => {
    const month = formatDate(endDate, "sentenceMonth", { year: "always" });

    return aim && minutes !== null
      ? t("At {time} a day, you reach {level} around {month}.", {
          level: aim,
          month,
          time: formatDuration(minutes),
        })
      : t("You finish around {month}.", { month });
  };
}
