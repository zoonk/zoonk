import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { MAX_DAILY_MINUTES } from "../daily-minutes";
import { DAYS_PER_WEEK, type LightWeek, type PlanSettings } from "./plan-state";
import { getWeekShape, isWeekend } from "./week-shape";

const ISO_DATE_LENGTH = 10;
const SUNDAY = 0;

const LIGHT_WEEK_FACTOR = 0.5;

export type StudyCalendar = {
  dailyMinutes: number;
  firstDay: Date | null;
  lightWeeks: readonly LightWeek[];
  /** Sunday first; null for the daily minutes every day. */
  weekdayMinutes: readonly number[] | null;
};

/** Dates are UTC-midnight labels of learner-local days, as `@db.Date` columns store them. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

export function fromIsoDate(value: string): Date {
  return parseLocalDate(value);
}

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

/** Weeks run Monday to Sunday, as the week view shows. */
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

export function getWeekdayMinutes({
  calendar,
  weekday,
}: {
  calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">;
  weekday: number;
}): number {
  return calendar.weekdayMinutes?.[weekday] ?? calendar.dailyMinutes;
}

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

export function countStudyDays(calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">) {
  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    getWeekdayMinutes({ calendar, weekday }),
  ).filter((minutes) => minutes > 0).length;
}

const WEEK_FROM_ITS_END = Array.from(
  { length: DAYS_PER_WEEK },
  (_, index) => (DAYS_PER_WEEK - index) % DAYS_PER_WEEK,
);

export function getWeeklyEventWeekday(
  calendar: Pick<StudyCalendar, "dailyMinutes" | "weekdayMinutes">,
): number {
  return (
    WEEK_FROM_ITS_END.find((weekday) => getWeekdayMinutes({ calendar, weekday }) > 0) ?? SUNDAY
  );
}
