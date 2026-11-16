"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { getIsoDay } from "@zoonk/utils/calendar-day";
import { MS_PER_DAY } from "@zoonk/utils/date";
import {
  type DateFormat,
  type DateRole,
  getIsoDateOptions,
  getIsoRangeOptions,
  isoDateToUtc,
} from "@zoonk/utils/date-format";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { useFormatter, useTimeZone } from "next-intl";
import { use } from "react";
import { PlanScreenContext } from "../plan/plan-context";

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

/** A day the server sends as UTC midnight, as its calendar day. */
export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, "YYYY-MM-DD".length);
}

type DateOptions = Omit<DateFormat, "role">;

const REFERENCE_SUNDAY = Date.parse("2023-01-01T00:00:00Z");

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

/** A calendar day from the server ("2027-11-14"), written for the place it has on the screen. */
export function useFormatIsoDate() {
  const format = useFormatter();
  const today = useIsoToday();

  return (isoDate: string, role: DateRole = "row", options: DateOptions = {}): string =>
    format.dateTime(isoDateToUtc(isoDate), getIsoDateOptions({ ...options, isoDate, role, today }));
}

/**
 * A run of calendar days, such as a week: "Nov 9 – 15". Node's ICU puts thin spaces around the dash
 * and browsers plain ones, so the spaces are normalized to hydrate cleanly.
 */
export function useFormatIsoRange() {
  const format = useFormatter();
  const today = useIsoToday();

  return ({ end, start }: { end: string; start: string }): string =>
    format
      .dateTimeRange(
        isoDateToUtc(start),
        isoDateToUtc(end),
        getIsoRangeOptions({ end, start, today }),
      )
      .replaceAll("\u2009", " ");
}

/** A weekday's name from its day or its number (Sunday is 0): "Tuesday", "Tue" or "T". */
export function useFormatWeekday() {
  const format = useFormatter();

  return (day: Date | number, width: "long" | "narrow" | "short" = "long"): string =>
    format.dateTime(typeof day === "number" ? new Date(REFERENCE_SUNDAY + day * MS_PER_DAY) : day, {
      timeZone: "UTC",
      weekday: width,
    });
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

  return (moment: Date | string, role: DateRole = "row", options: DateOptions = {}): string =>
    format.dateTime(new Date(moment), {
      ...getIsoDateOptions({ ...options, isoDate: dayOf(moment), role, today }),
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
  }: {
    isoDate: string;
    namedMonth: boolean;
  }): { date: string; dateKind: "day" | "month" } => ({
    date: (namedMonth
      ? formatDate(isoDate, "sentenceMonth", { year: "always" })
      : formatDate(isoDate, "sentence")
    ).replaceAll(" ", "\u00A0"),
    dateKind: namedMonth ? "month" : "day",
  });
}
