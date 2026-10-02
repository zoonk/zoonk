import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, getHourInTimeZone } from "@zoonk/utils/time-zone";

const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

export function daysFrom(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function minutesBefore(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * MS_PER_MINUTE);
}

/** The learner-local calendar day of an instant, as Prisma expects for `@db.Date` columns. */
export function localDay(date: Date, timeZone: string): Date {
  return getDateInTimeZone({ date, timeZone });
}

/**
 * The learner-local calendar day `days` days from the one `date` falls on, counted on the calendar
 * as the planner counts them: 24-hour steps from the instant land on the day before or after once
 * they cross a daylight saving change, when the local time is near midnight.
 */
export function localDayFrom({
  date,
  days,
  timeZone,
}: {
  date: Date;
  days: number;
  timeZone: string;
}): Date {
  return daysFrom(localDay(date, timeZone), days);
}

/**
 * The same day `daysAgo` days back, moved to a learner-local hour, so activity lands at the
 * learner's study time. Today's activity never lands in the future.
 */
export function atLocalHour({
  daysAgo,
  hour,
  now,
  timeZone,
}: {
  daysAgo: number;
  hour: number;
  now: Date;
  timeZone: string;
}): Date {
  const day = daysFrom(now, -daysAgo);
  const target = localDayFrom({ date: now, days: -daysAgo, timeZone });

  // Across a daylight saving change, `day` can fall late on the day before or early on the next.
  const hours =
    (target.getTime() - localDay(day, timeZone).getTime()) / MS_PER_HOUR +
    hour -
    getHourInTimeZone({ date: day, timeZone });

  const shifted = new Date(day.getTime() + hours * MS_PER_HOUR);

  return shifted > now ? minutesBefore(now, 45) : shifted;
}

/** Learner-local date, hour and weekday of an instant, as attempts and ledger rows store them. */
export function localTimeFields(date: Date, timeZone: string) {
  const day = localDay(date, timeZone);

  return { hour: getHourInTimeZone({ date, timeZone }), localDate: day, weekday: day.getUTCDay() };
}
