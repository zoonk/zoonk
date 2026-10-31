import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, getHourInTimeZone, getTimeZoneOffsetMs } from "@zoonk/utils/time-zone";

export function getLocalAnswerTime({ date, timeZone }: { date: Date; timeZone: string }) {
  const localDate = getDateInTimeZone({ date, timeZone });

  return { hour: getHourInTimeZone({ date, timeZone }), localDate, weekday: localDate.getUTCDay() };
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** The window must exceed every UTC offset, including UTC+14. */
const MAX_OFFSET_HOURS = 15;
const MAX_OFFSET_MS = MAX_OFFSET_HOURS * MS_PER_HOUR;

/** No zone changes twice within this scan interval. */
const SCAN_STEP_MINUTES = 15;
const SCAN_STEP_MS = SCAN_STEP_MINUTES * MS_PER_MINUTE;

function getLocalDateMs(ms: number, timeZone: string): number {
  return getDateInTimeZone({ date: new Date(ms), timeZone }).getTime();
}

/** Repeated midnights use their first occurrence; historical offsets may require second-level precision. */
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

/** localDate is a UTC-midnight label; returns the first real instant of that local date, including skipped/repeated midnights. */
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
