"use client";

import { MS_PER_DAY } from "@zoonk/utils/date";
import { type DateTimeFormatOptions, useFormatter } from "next-intl";
import { use } from "react";
import { PlanScreenContext } from "../plan/plan-context";

/** UTC midnight, formatted in UTC, so the day never shifts in the viewer's timezone. */
export function isoDateToUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function daysUntilIsoDate({ isoDate, today }: { isoDate: string; today: Date }): number {
  return Math.max(0, countDaysUntil({ isoDate, today }));
}

function countDaysUntil({ isoDate, today }: { isoDate: string; today: Date }): number {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((isoDateToUtc(isoDate).getTime() - start) / MS_PER_DAY);
}

export function hasIsoDatePassed({ isoDate, today }: { isoDate: string; today: Date }): boolean {
  return countDaysUntil({ isoDate, today }) < 0;
}

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

const YEAR_WHEN_ANOTHER_YEAR = new Set<DateStyle>(["day", "long"]);

function getDateOptions({ date, style, today }: { date: Date; style: DateStyle; today?: string }) {
  const options = DATE_STYLES[style];
  const year = today ? isoDateToUtc(today).getUTCFullYear() : new Date().getFullYear();
  const isAnotherYear = date.getUTCFullYear() !== year;

  return YEAR_WHEN_ANOTHER_YEAR.has(style) && isAnotherYear
    ? { ...options, year: "numeric" as const }
    : options;
}

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
