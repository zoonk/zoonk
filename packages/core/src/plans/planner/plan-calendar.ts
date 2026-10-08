import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { DAYS_PER_WEEK, type LightWeek, type PlanSettings } from "./plan-state";

const ISO_DATE_LENGTH = 10;
const SUNDAY = 0;

/** A light week keeps half the usual time: enough to keep reviews going, not enough to tire. */
const LIGHT_WEEK_FACTOR = 0.5;

/** When and how long the learner studies for one goal. */
export type StudyCalendar = {
  dailyMinutes: number;
  /**
   * The plan's first day. It always has study time, so a learner who finishes onboarding on a
   * weekday they rest starts right away; the week's shape takes over the next day.
   */
  firstDay: Date | null;
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

/** A goal's study calendar: its daily time and its plan's weekly shape, light weeks and first day. */
export function getPlanCalendar({
  dailyMinutes,
  settings,
}: {
  dailyMinutes: number;
  settings: Pick<PlanSettings, "lightWeeks" | "startDate" | "weekdayMinutes">;
}): StudyCalendar {
  return {
    dailyMinutes,
    firstDay: settings.startDate ? fromIsoDate(settings.startDate) : null,
    lightWeeks: settings.lightWeeks,
    weekdayMinutes: settings.weekdayMinutes,
  };
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

function isFirstDay({ calendar, date }: { calendar: StudyCalendar; date: Date }): boolean {
  return calendar.firstDay?.getTime() === date.getTime();
}

/**
 * The minutes the learner studies on one date: the weekday's time (the daily time on the plan's
 * first day, even when its weekday rests), halved in a light week.
 */
export function getStudyMinutes({
  calendar,
  date,
}: {
  calendar: StudyCalendar;
  date: Date;
}): number {
  const weekdayMinutes = getWeekdayMinutes({ calendar, weekday: date.getUTCDay() });

  const minutes =
    weekdayMinutes === 0 && isFirstDay({ calendar, date }) ? calendar.dailyMinutes : weekdayMinutes;

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

/** The week's days from its last, Sunday, back to Monday. */
const WEEK_FROM_ITS_END = Array.from(
  { length: DAYS_PER_WEEK },
  (_, index) => (DAYS_PER_WEEK - index) % DAYS_PER_WEEK,
);

/**
 * The day a weekly checkpoint or mock exam goes on, the same every week: the week's last study
 * day, Sunday when the learner studies on Sundays, else the nearest study day before it. A rest
 * day is never taken, even when the exam itself falls on that weekday.
 */
export function getWeeklyEventWeekday(
  calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">,
): number {
  return (
    WEEK_FROM_ITS_END.find((weekday) => getWeekdayMinutes({ calendar, weekday }) > 0) ?? SUNDAY
  );
}
