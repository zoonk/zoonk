"use client";

import { useExtracted, useFormatter } from "next-intl";
import { isoDateToUtc } from "../_utils/iso-date";

function useStartWords() {
  const format = useFormatter();

  return (isoDate: string) => {
    const date = isoDateToUtc(isoDate);
    const now = new Date();
    const isThisYear = date.getUTCFullYear() === now.getFullYear();
    const isThisMonth = isThisYear && date.getUTCMonth() === now.getMonth();

    if (isThisMonth) {
      return {
        dateKind: "day",
        start: format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC" }),
      };
    }

    return {
      dateKind: "month",
      start: format.dateTime(date, {
        month: "long",
        timeZone: "UTC",
        ...(isThisYear ? {} : { year: "numeric" }),
      }),
    };
  };
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
            message: "{dateKind, select, month {From {start}} other {From {start}}}",
            values: startWords(nextDate),
          })
        : null;
    }

    const count = t("{count, plural, =1 {# lesson} other {About # lessons}}", { count: lessons });

    return nextDate
      ? t({
          description: '{start} is a day, like "Nov 5", or a month, like "December".',
          message:
            "{dateKind, select, month {{count} · from {start}} other {{count} · from {start}}}",
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
  }) => (far ? farLine({ lessons, nextDate }) : t("Lessons on the way"));
}
