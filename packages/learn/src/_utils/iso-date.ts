"use client";

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
import { useExtracted, useFormatter } from "next-intl";
import { use } from "react";
import { PlanScreenContext } from "../plan/plan-context";
import { type LearnerClock, useLearnerClock } from "./learner-clock";

export function getTodayInZone({ now, timeZone }: { now: Date; timeZone: string | null }): string {
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";

  return getDateInTimeZone({ date: now, timeZone: zone })
    .toISOString()
    .slice(0, "YYYY-MM-DD".length);
}

/** Core counts a goal's or draft's days in its zone, UTC without one, so date pickers do too. */
export function useTodayInZone(timeZone: string | null): string {
  return getTodayInZone({ now: useLearnerClock().now, timeZone });
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

/** Today as a calendar day: the plan's own day, or today on the learner's clock. */
export function useIsoToday(): string {
  const plan = use(PlanScreenContext);
  const clock = useLearnerClock();

  return plan?.today ?? getIsoDay(clock);
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

/** An instant's calendar day and today's, in the clock's zone, for "Today" and "Yesterday". */
export function getMomentDays({ now, timeZone }: LearnerClock) {
  return {
    dayOf: (moment: Date | string) => getIsoDay({ now: new Date(moment), timeZone }),
    today: getIsoDay({ now, timeZone }),
  };
}

export function useMomentDays() {
  return getMomentDays(useLearnerClock());
}

/** Its day and today are read in the clock's zone, so the year shows exactly when the drawn date is in another year. */
export function getMomentDateOptions({
  clock,
  moment,
  role = "row",
  ...options
}: DateFormat & { clock: LearnerClock; moment: Date | string }): Omit<
  ReturnType<typeof getIsoDateOptions>,
  "timeZone"
> & { timeZone: string } {
  const { dayOf, today } = getMomentDays(clock);

  return {
    ...getIsoDateOptions({ ...options, isoDate: dayOf(moment), role, today }),
    timeZone: clock.timeZone,
  };
}

/** An instant (a timestamp), drawn in the learner's zone. */
export function useFormatMomentDate() {
  const format = useFormatter();
  const clock = useLearnerClock();

  return (moment: Date | string, role: DateRole = "row", options: DateOptions = {}): string =>
    format.dateTime(new Date(moment), getMomentDateOptions({ ...options, clock, moment, role }));
}

/** An instant's time of day ("2:32 PM"), in the learner's zone. */
export function useFormatMomentTime() {
  const format = useFormatter();
  const { timeZone } = useLearnerClock();

  return (moment: Date | string): string =>
    format.dateTime(new Date(moment), { hour: "numeric", minute: "2-digit", timeZone });
}

/**
 * Messages `select` on `dateKind`, since a month and a day take different words around them. The
 * date keeps its words on one line, so a sentence never breaks between a day and its year.
 */
/** An estimated date (an exam's likely day) is marked "~", as the plan marks it. */
export function useGoalDateValues() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return ({
    estimated = false,
    isoDate,
    namedMonth,
  }: {
    estimated?: boolean;
    isoDate: string;
    namedMonth: boolean;
  }): { date: string; dateKind: "day" | "month" } => {
    const date = (
      namedMonth
        ? formatDate(isoDate, "sentenceMonth", { year: "always" })
        : formatDate(isoDate, "sentence")
    ).replaceAll(" ", "\u00A0");

    return {
      date: estimated ? t("~{date}", { date }) : date,
      dateKind: namedMonth ? "month" : "day",
    };
  };
}
