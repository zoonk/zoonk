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
      return format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC" });
    }

    return format.dateTime(date, {
      month: "long",
      timeZone: "UTC",
      ...(isThisYear ? {} : { year: "numeric" }),
    });
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
      return nextDate ? t("From {start}", { start: startWords(nextDate) }) : null;
    }

    const count = t("{count, plural, =1 {# lesson} other {About # lessons}}", { count: lessons });

    return nextDate ? t("{count} · from {start}", { count, start: startWords(nextDate) }) : count;
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
