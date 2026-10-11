"use client";

import { useExtracted, useFormatter } from "next-intl";
import { isoDateToUtc } from "../_utils/iso-date";

/**
 * When a far topic starts, as its row says it: the day while it's this month ("Oct 14"), else its
 * month ("March"), with the year once it's another year's.
 */
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

/**
 * What the plan knows about a topic whose lessons aren't written yet, instead of "being written":
 * the lessons it teaches the topic, an estimate, and when it starts ("About 12 lessons · from
 * March"). One lesson (a base studied in a quick lesson) is just that: "1 lesson". A plan saved
 * before it stored how many (`lessons` null) says only when it starts, or nothing without a date.
 */
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

/**
 * The line under a topic whose lessons aren't written yet: what the plan knows about it once it
 * starts after the weeks the plan writes ahead (`far`), whether or not it can be opened early,
 * else that its lessons are on the way. `nextDate` is left out where the row shows the date
 * already.
 */
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
