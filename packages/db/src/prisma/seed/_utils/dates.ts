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

export function localDay(date: Date, timeZone: string): Date {
  return getDateInTimeZone({ date, timeZone });
}

/**
 * Counts calendar days as the planner does: 24-hour steps land on the wrong day across a daylight
 * saving change near midnight.
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

/** Today's activity never lands in the future. */
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

  if (shifted <= now) {
    return shifted;
  }

  const earlier = minutesBefore(now, 45);

  // Just after midnight, the usual lead time would put today's activity on yesterday.
  return localDay(earlier, timeZone).getTime() === target.getTime() ? earlier : now;
}

export function localTimeFields(date: Date, timeZone: string) {
  const day = localDay(date, timeZone);

  return { hour: getHourInTimeZone({ date, timeZone }), localDate: day, weekday: day.getUTCDay() };
}
