"use client";

import { MS_PER_DAY } from "@zoonk/utils/date";
import { type DateTimeFormatOptions, useFormatter } from "next-intl";
import { use } from "react";
import { PlanScreenContext } from "../plan/plan-context";

/**
 * View models send calendar days as "YYYY-MM-DD" labels in the learner's day. Reading them as UTC
 * midnight and formatting in UTC keeps the day from shifting in the viewer's timezone.
 */
export function isoDateToUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** The viewer's own calendar day as "YYYY-MM-DD", as view models label days. */
export function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole days from the viewer's today to a view model's calendar day, never below zero. */
export function daysUntilIsoDate({ isoDate, today }: { isoDate: string; today: Date }): number {
  return Math.max(0, countDaysUntil({ isoDate, today }));
}

/** Whole days from the browser's `today` to a YYYY-MM-DD date, negative once it passed. */
function countDaysUntil({ isoDate, today }: { isoDate: string; today: Date }): number {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((isoDateToUtc(isoDate).getTime() - start) / MS_PER_DAY);
}

/**
 * The date is behind the browser's `today`: a goal's date that passed has no days left to count.
 */
export function hasIsoDatePassed({ isoDate, today }: { isoDate: string; today: Date }): boolean {
  return countDaysUntil({ isoDate, today }) < 0;
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round((isoDateToUtc(to).getTime() - isoDateToUtc(from).getTime()) / MS_PER_DAY);
}

type DateStyle =
  | "day"
  | "dayMonth"
  | "long"
  | "longYear"
  | "month"
  | "monthShort"
  | "short"
  | "weekday"
  | "weekdayDay"
  | "weekdayShort";

const DATE_STYLES: Record<DateStyle, DateTimeFormatOptions> = {
  day: { day: "numeric", month: "short" },
  dayMonth: { day: "numeric", month: "long" },
  long: { day: "numeric", month: "long" },
  longYear: { day: "numeric", month: "long", year: "numeric" },
  month: { month: "long", year: "numeric" },
  monthShort: { month: "short", year: "numeric" },
  short: { day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "long" },
  weekdayDay: { day: "numeric", month: "long", weekday: "long" },
  weekdayShort: { weekday: "short" },
};

/**
 * Day-and-month styles that name the year once the day isn't in this year, so a plan's end in
 * 2028 never reads as this year's date. `dayMonth` never does: for lists whose year is stated
 * right beside them.
 */
const YEAR_WHEN_ANOTHER_YEAR = new Set<DateStyle>(["day", "long"]);

function getDateOptions({ date, style, today }: { date: Date; style: DateStyle; today?: string }) {
  const options = DATE_STYLES[style];
  const year = today ? isoDateToUtc(today).getUTCFullYear() : new Date().getFullYear();
  const isAnotherYear = date.getUTCFullYear() !== year;

  return YEAR_WHEN_ANOTHER_YEAR.has(style) && isAnotherYear
    ? { ...options, year: "numeric" as const }
    : options;
}

/** Formats a view model's calendar day in the viewer's language. */
export function useFormatIsoDate() {
  const format = useFormatter();
  const plan = use(PlanScreenContext);

  return (isoDate: string, style: DateStyle = "day") => {
    const date = isoDateToUtc(isoDate);

    return format.dateTime(date, {
      ...getDateOptions({ date, style, today: plan?.today }),
      timeZone: "UTC",
    });
  };
}

/**
 * A goal's date as the learner gave it: the month they named ("December 2026") when the date
 * stands for that month (`namedMonth`), else the day in `style`.
 */
export function useFormatGoalDate() {
  const formatDate = useFormatIsoDate();

  return ({
    isoDate,
    namedMonth,
    style = "day",
  }: {
    isoDate: string;
    namedMonth: boolean;
    style?: DateStyle;
  }): string => formatDate(isoDate, namedMonth ? "month" : style);
}
