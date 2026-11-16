"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useFormatWeekday } from "../_utils/iso-date";

/** A week's seven days across the column, Monday first as the plan's week runs. */
export const WEEK_ROW_CLASS = "flex w-full justify-between";

/** A day of the row: its ring, then its letter under it. */
export const WEEK_DAY_CLASS = "flex flex-col items-center gap-1.5";

const DAY_LETTER_CLASS = "text-2xs font-mono uppercase";

/** The day's letter under its ring; today's is the one that stands out. */
export function WeekDayLetter({ date, isToday }: { date: Date; isToday: boolean }) {
  const formatWeekday = useFormatWeekday();

  return (
    <span
      aria-hidden="true"
      className={cn(DAY_LETTER_CLASS, isToday ? "text-foreground font-medium" : "text-faint")}
      data-slot="week-day-letter"
    >
      {formatWeekday(date, "narrow")}
    </span>
  );
}

/** A letter's room while the week loads. */
export function WeekDayLetterSkeleton() {
  return <span className={DAY_LETTER_CLASS}>{"\u00A0"}</span>;
}
