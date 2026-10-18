import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, getTimeZoneOffsetMs } from "@zoonk/utils/time-zone";

const MS_PER_SECOND = 1000;

/** The calendar day an instant falls on in one time zone, as "YYYY-MM-DD". */
export function getIsoDay({ now, timeZone }: { now: Date; timeZone: string }): string {
  return getDateInTimeZone({ date: now, timeZone }).toISOString().slice(0, 10);
}

/** Whole days from one "YYYY-MM-DD" day to another. */
export function daysBetweenIsoDays({ from, to }: { from: string; to: string }): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/** The "YYYY-MM-DD" day a number of days after another (before it, when negative). */
export function addIsoDays({ day, days }: { day: string; days: number }): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Clock changes start and end on the quarter hour, so a day's first instant is on one. */
const QUARTER_HOURS_PER_DAY = 96;
const QUARTER_HOUR_MS = MS_PER_DAY / QUARTER_HOURS_PER_DAY;

/** Enough quarter hours to step over any clock change's gap (at most a few hours). */
const MAX_GAP_STEPS = 16;

/**
 * Seconds from an instant to the next day's first instant on the wall clock of one time zone. The
 * next day starts at its own offset, which a daylight saving change makes differ from today's; a
 * zone whose clocks jump forward at midnight has no midnight that night, and the day starts when
 * the jump lands.
 */
export function getSecondsToMidnight({ now, timeZone }: { now: Date; timeZone: string }): number {
  const nextDay = addIsoDays({ day: getIsoDay({ now, timeZone }), days: 1 });
  const nextDayLabel = Date.parse(`${nextDay}T00:00:00Z`);
  const offsetAt = (instant: number) => getTimeZoneOffsetMs({ date: new Date(instant), timeZone });

  const isNextDay = (instant: number) =>
    getIsoDay({ now: new Date(instant), timeZone }) === nextDay;

  let start = nextDayLabel - offsetAt(nextDayLabel - offsetAt(nextDayLabel));

  for (let step = 0; step < MAX_GAP_STEPS && !isNextDay(start); step += 1) {
    start += QUARTER_HOUR_MS;
  }

  return Math.ceil((start - now.getTime()) / MS_PER_SECOND);
}
