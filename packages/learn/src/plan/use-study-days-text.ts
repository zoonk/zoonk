"use client";

import { useExtracted } from "next-intl";
import { useFormatWeekday } from "../_utils/use-format-weekday";

const DAYS_PER_WEEK = 7;

const MONDAY_FIRST: readonly number[] = Array.from(
  { length: DAYS_PER_WEEK },
  (_, index) => (index + 1) % DAYS_PER_WEEK,
);

const MIN_RANGE_DAYS = 3;

function isOneRun(days: readonly number[]): boolean {
  const positions = days.map((day) => MONDAY_FIRST.indexOf(day));

  return positions.every(
    (position, index) => index === 0 || position === (positions[index - 1] ?? 0) + 1,
  );
}

export function useStudyDaysText() {
  const t = useExtracted();
  const formatWeekday = useFormatWeekday();

  return (weekdayMinutes: readonly number[]): string => {
    const days = MONDAY_FIRST.filter((day) => (weekdayMinutes[day] ?? 0) > 0);
    const [first] = days;
    const last = days.at(-1);

    if (days.length === DAYS_PER_WEEK) {
      return t("Every day");
    }

    if (
      first !== undefined &&
      last !== undefined &&
      days.length >= MIN_RANGE_DAYS &&
      isOneRun(days)
    ) {
      return t("{first} – {last}", {
        first: formatWeekday(first, "short"),
        last: formatWeekday(last, "short"),
      });
    }

    return days.map((day) => formatWeekday(day, "short")).join(", ");
  };
}
