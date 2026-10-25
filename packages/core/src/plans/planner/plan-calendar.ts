import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { MAX_DAILY_MINUTES } from "../daily-minutes";
import { DAYS_PER_WEEK, type LightWeek, type PlanSettings } from "./plan-state";
import { getWeekShape, isWeekend } from "./week-shape";

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

/** The minutes of the learner's average study day: their week's days with time, before light weeks. */
export function getStudyDayMinutes(
  calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">,
): number {
  const days = (calendar.weekdayMinutes ?? [calendar.dailyMinutes]).filter(
    (minutes) => minutes > 0,
  );

  return days.length > 0 ? days.reduce((sum, minutes) => sum + minutes, 0) / days.length : 0;
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
 * Changes the daily time and keeps the week's shape: rest days stay rest days and the weekdays move
 * in proportion, a lighter day staying lighter. A weekend with its own time keeps it (see
 * `getWeekShape`): the learner gave it apart from the daily time, as onboarding and the plan
 * editor ask it, so "an hour a day" changes the weekdays and leaves their Saturday as it was. A
 * day never goes past a whole day, the most the saved settings hold: a Friday twice the others at
 * 30 minutes takes 1440 at 1070 a day, not 2140, so the plan a time is asked about is the one saved.
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

  const { weekend } = getWeekShape({ dailyMinutes: from, weekdayMinutes });

  return weekdayMinutes.map((minutes, weekday) => {
    if (minutes === 0 || (weekend !== null && isWeekend(weekday))) {
      return minutes;
    }

    const scaled = Math.round((minutes * dailyMinutes) / Math.max(from, 1));
    return Math.min(MAX_DAILY_MINUTES, Math.max(1, scaled));
  });
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
