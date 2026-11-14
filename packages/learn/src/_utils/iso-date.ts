"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { getIsoDay, isInAnotherYear } from "@zoonk/utils/calendar-day";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { type DateTimeFormatOptions, useFormatter, useTimeZone } from "next-intl";
import { use } from "react";
import { PlanScreenContext } from "../plan/plan-context";

/** UTC midnight, formatted in UTC, so the day never shifts in the viewer's timezone. */
export function isoDateToUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** Core counts a goal's or draft's days in its zone, UTC without one, so date pickers do too. */
export function getTodayInZone({ now, timeZone }: { now: Date; timeZone: string | null }): string {
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";

  return getDateInTimeZone({ date: now, timeZone: zone })
    .toISOString()
    .slice(0, "YYYY-MM-DD".length);
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

export type DateStyle =
  | "day"
  | "dayMonth"
  | "long"
  | "longYear"
  | "month"
  | "monthName"
  | "monthShort"
  | "short"
  | "weekday"
  | "weekdayDay"
  | "weekdayLongYear";

const DATE_STYLES: Record<DateStyle, DateTimeFormatOptions> = {
  day: { day: "numeric", month: "short" },
  dayMonth: { day: "numeric", month: "long" },
  long: { day: "numeric", month: "long" },
  longYear: { day: "numeric", month: "long", year: "numeric" },
  month: { month: "long", year: "numeric" },
  monthName: { month: "long" },
  monthShort: { month: "short", year: "numeric" },
  short: { day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "long" },
  weekdayDay: { day: "numeric", month: "long", weekday: "long" },
  weekdayLongYear: { day: "numeric", month: "long", weekday: "long", year: "numeric" },
};

const YEAR_WHEN_ANOTHER_YEAR = new Set<DateStyle>(["day", "long", "monthName", "weekdayDay"]);

function getStyleOptions({
  isoDate,
  style,
  today,
}: {
  isoDate: string;
  style: DateStyle;
  today: string;
}): DateTimeFormatOptions {
  const options = DATE_STYLES[style];

  return YEAR_WHEN_ANOTHER_YEAR.has(style) && isInAnotherYear({ isoDate, today })
    ? { ...options, year: "numeric" }
    : options;
}

/**
 * The zone every date is drawn in: the provider's, which Main sets to the server's, so the server's
 * HTML and the browser's first render say the same words.
 */
function useDrawingTimeZone(): string {
  return useTimeZone() ?? "UTC";
}

/** Today as a calendar day: the plan's own day, or today in the zone dates are drawn in. */
export function useIsoToday(): string {
  const plan = use(PlanScreenContext);
  const timeZone = useDrawingTimeZone();
  const mountedAt = useMountTime();

  return plan?.today ?? getIsoDay({ now: mountedAt, timeZone });
}

/** A calendar day from the server ("2027-11-14"), drawn as that day at UTC midnight. */
export function getIsoDateOptions({
  isoDate,
  style,
  today,
}: {
  isoDate: string;
  style: DateStyle;
  today: string;
}): DateTimeFormatOptions {
  return { ...getStyleOptions({ isoDate, style, today }), timeZone: "UTC" };
}

export function useFormatIsoDate() {
  const format = useFormatter();
  const today = useIsoToday();

  return (isoDate: string, style: DateStyle = "day") =>
    format.dateTime(isoDateToUtc(isoDate), getIsoDateOptions({ isoDate, style, today }));
}

/** An instant's calendar day and today's, in the zone it's drawn in, for "Today" and "Yesterday". */
export function useMomentDays() {
  const timeZone = useDrawingTimeZone();
  const now = useMountTime();

  return {
    dayOf: (moment: Date | string) => getIsoDay({ now: new Date(moment), timeZone }),
    today: getIsoDay({ now, timeZone }),
  };
}

/**
 * An instant (a timestamp), drawn in the provider's zone; its day and today are read in that same
 * zone, so the year shows exactly when the drawn date is in another year.
 */
export function useFormatMomentDate() {
  const format = useFormatter();
  const timeZone = useDrawingTimeZone();
  const { dayOf, today } = useMomentDays();

  return (moment: Date | string, style: DateStyle = "day"): string =>
    format.dateTime(new Date(moment), {
      ...getStyleOptions({ isoDate: dayOf(moment), style, today }),
      timeZone,
    });
}

/**
 * Messages `select` on `dateKind`, since a month and a day take different words around them. The
 * date keeps its words on one line, so a sentence never breaks between a day and its year.
 */
export function useGoalDateValues() {
  const formatDate = useFormatIsoDate();

  return ({
    isoDate,
    namedMonth,
    style = "day",
  }: {
    isoDate: string;
    namedMonth: boolean;
    style?: DateStyle;
  }): { date: string; dateKind: "day" | "month" } => ({
    date: formatDate(isoDate, namedMonth ? "month" : style).replaceAll(" ", "\u00A0"),
    dateKind: namedMonth ? "month" : "day",
  });
}
