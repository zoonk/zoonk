import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { DAYS_PER_WEEK, type LightWeek } from "./plan-state";

const ISO_DATE_LENGTH = 10;
const SUNDAY = 0;

/** A light week keeps half the usual time: enough to keep reviews going, not enough to tire. */
const LIGHT_WEEK_FACTOR = 0.5;

/** When and how long the learner studies for one goal. */
export type StudyCalendar = {
  dailyMinutes: number;
  lightWeeks: readonly LightWeek[];
  /** Minutes per weekday, Sunday first, or null for the daily minutes every day. */
  weekdayMinutes: readonly number[] | null;
};

/** Dates are UTC-midnight labels of learner-local days, as `@db.Date` columns store them. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days from one local date to another (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

export function fromIsoDate(value: string): Date {
  return parseLocalDate(value);
}

/** The last day of the week a date falls in. Weeks run Monday to Sunday, as the week view shows. */
export function getEndOfWeek(date: Date): Date {
  const weekday = date.getUTCDay();
  return addDays(date, weekday === SUNDAY ? 0 : DAYS_PER_WEEK - weekday);
}

export function getStartOfWeek(date: Date): Date {
  return addDays(getEndOfWeek(date), 1 - DAYS_PER_WEEK);
}

function isInLightWeek({ date, lightWeeks }: { date: Date; lightWeeks: readonly LightWeek[] }) {
  const day = toIsoDate(date);
  return lightWeeks.some((week) => week.startDate <= day && day <= week.endDate);
}

/** The minutes the learner planned for one weekday, before light weeks. */
export function getWeekdayMinutes({
  calendar,
  weekday,
}: {
  calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">;
  weekday: number;
}): number {
  return calendar.weekdayMinutes?.[weekday] ?? calendar.dailyMinutes;
}

/** The minutes the learner studies on one date: the weekday's time, halved in a light week. */
export function getStudyMinutes({
  calendar,
  date,
}: {
  calendar: StudyCalendar;
  date: Date;
}): number {
  const minutes = getWeekdayMinutes({ calendar, weekday: date.getUTCDay() });

  return isInLightWeek({ date, lightWeeks: calendar.lightWeeks })
    ? Math.round(minutes * LIGHT_WEEK_FACTOR)
    : minutes;
}

/**
 * Changes the daily time and keeps the week's shape: "less on weekends" stays less, rest days stay
 * rest days, and every study day moves in proportion.
 */
export function scaleWeekdayMinutes({
  dailyMinutes,
  from,
  weekdayMinutes,
}: {
  dailyMinutes: number;
  from: number;
  weekdayMinutes: readonly number[] | null;
}): number[] | null {
  if (!weekdayMinutes) {
    return null;
  }

  return weekdayMinutes.map((minutes) =>
    minutes === 0 ? 0 : Math.max(1, Math.round((minutes * dailyMinutes) / Math.max(from, 1))),
  );
}

/** How many days a week have study time: "6 days a week". */
export function countStudyDays(calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">) {
  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    getWeekdayMinutes({ calendar, weekday }),
  ).filter((minutes) => minutes > 0).length;
}

/**
 * The day a weekly checkpoint or mock exam goes on: Sunday, unless the learner rests on another
 * day and studies on Sunday. Then it's their last rest day, so it doesn't take a study day's time.
 */
export function getWeeklyEventWeekday(
  calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">,
): number {
  const restDays = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => weekday).filter(
    (weekday) => getWeekdayMinutes({ calendar, weekday }) === 0,
  );

  if (restDays.length === 0 || restDays.includes(SUNDAY)) {
    return SUNDAY;
  }

  return Math.max(...restDays);
}
