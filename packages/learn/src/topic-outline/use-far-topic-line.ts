"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate, useIsoToday } from "../_utils/iso-date";

const MONTH_LENGTH = "YYYY-MM".length;

function useStartWords() {
  const formatDate = useFormatIsoDate();
  const today = useIsoToday();

  return (isoDate: string) =>
    isoDate.slice(0, MONTH_LENGTH) === today.slice(0, MONTH_LENGTH)
      ? { dateKind: "day", start: formatDate(isoDate, "day") }
      : { dateKind: "month", start: formatDate(isoDate, "monthName") };
}

export function useFarTopicLine() {
  const t = useExtracted();
  const startWords = useStartWords();

  return function farTopicLine({
    lessons,
    nextDate = null,
  }: {
    lessons: number | null;
    nextDate?: string | null;
  }): string | null {
    if (lessons === null) {
      return nextDate
        ? t({
            description: '{start} is a day, like "Nov 5", or a month, like "December".',
            message: "{dateKind, select, month {Starts in {start}} other {Starts {start}}}",
            values: startWords(nextDate),
          })
        : null;
    }

    const count = t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons });

    return nextDate
      ? t({
          description: '{start} is a day, like "Nov 5", or a month, like "December".',
          message:
            "{dateKind, select, month {{count} · starts in {start}} other {{count} · starts {start}}}",
          values: { count, ...startWords(nextDate) },
        })
      : count;
  };
}

export function useWritingLine() {
  const t = useExtracted();
  const farLine = useFarTopicLine();

  return ({
    far,
    lessons,
    nextDate = null,
  }: {
    far: boolean;
    lessons: number | null;
    nextDate?: string | null;
  }) => (far ? farLine({ lessons, nextDate }) : t("Not ready yet"));
}
