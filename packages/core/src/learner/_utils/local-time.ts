import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, getHourInTimeZone, getTimeZoneOffsetMs } from "@zoonk/utils/time-zone";

/** Learner-local date, hour and weekday of an instant, as `Attempt` stores them. */
export function getLocalAnswerTime({ date, timeZone }: { date: Date; timeZone: string }) {
  const localDate = getDateInTimeZone({ date, timeZone });

  return { hour: getHourInTimeZone({ date, timeZone }), localDate, weekday: localDate.getUTCDay() };
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** Wider than any zone's offset from UTC (up to 14 hours), so this window around a label holds its day's start. */
const MAX_OFFSET_HOURS = 15;
const MAX_OFFSET_MS = MAX_OFFSET_HOURS * MS_PER_HOUR;

/** How far apart the walk to a changing day's first instant looks: no zone changes twice within it. */
const SCAN_STEP_MINUTES = 15;
const SCAN_STEP_MS = SCAN_STEP_MINUTES * MS_PER_MINUTE;

function getLocalDateMs(ms: number, timeZone: string): number {
  return getDateInTimeZone({ date: new Date(ms), timeZone }).getTime();
}

/**
 * The first instant whose local date is `day`, for a day near a change of the clocks: walks forward
 * from before any zone's start of it, a quarter-hour at a time, to the first instant on it (so a
 * midnight the clocks repeat after going back across it counts its first time), then narrows that
 * quarter-hour to the second (some historical offsets aren't whole minutes).
 */
function findFirstInstantOfDay(day: number, timeZone: string): Date {
  let before = day - MAX_OFFSET_MS - SCAN_STEP_MS;
  let onDay = before + SCAN_STEP_MS;

  while (getLocalDateMs(onDay, timeZone) < day) {
    before = onDay;
    onDay += SCAN_STEP_MS;
  }

  while (onDay - before > MS_PER_SECOND) {
    const middle = Math.floor((before + onDay) / 2 / MS_PER_SECOND) * MS_PER_SECOND;

    if (getLocalDateMs(middle, timeZone) >= day) {
      onDay = middle;
    } else {
      before = middle;
    }
  }

  return new Date(onDay);
}

/**
 * The instant a learner-local calendar day starts. `localDate` is the UTC-midnight label of that
 * day (as `getDateInTimeZone` returns it). On a day whose offset holds through the hours before it,
 * that's its midnight at that offset. Near a change of the clocks (a skipped midnight, as Havana's
 * spring change from 23:59 to 01:00; a repeated one, as Vostok's 2023 change from 02:00 back to
 * 00:00), it's the first instant whose date it is.
 */
export function getStartOfLocalDay({
  localDate,
  timeZone,
}: {
  localDate: Date;
  timeZone: string;
}): Date {
  const day = localDate.getTime();
  const offset = getTimeZoneOffsetMs({ date: localDate, timeZone });
  const start = day - offset;

  const isSteady =
    getTimeZoneOffsetMs({ date: new Date(day - MAX_OFFSET_MS), timeZone }) === offset &&
    getTimeZoneOffsetMs({ date: new Date(start), timeZone }) === offset;

  return isSteady ? new Date(start) : findFirstInstantOfDay(day, timeZone);
}

/** Whole learner-local calendar days from one instant to another (negative when `to` is earlier). */
export function getLocalDaysBetween({
  from,
  timeZone,
  to,
}: {
  from: Date;
  timeZone: string;
  to: Date;
}): number {
  const fromDay = getDateInTimeZone({ date: from, timeZone }).getTime();
  const toDay = getDateInTimeZone({ date: to, timeZone }).getTime();

  return Math.round((toDay - fromDay) / MS_PER_DAY);
}
