import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, getHourInTimeZone, getTimeZoneOffsetMs } from "@zoonk/utils/time-zone";

/** Learner-local date, hour and weekday of an instant, as `Attempt` stores them. */
export function getLocalAnswerTime({ date, timeZone }: { date: Date; timeZone: string }) {
  const localDate = getDateInTimeZone({ date, timeZone });

  return { hour: getHourInTimeZone({ date, timeZone }), localDate, weekday: localDate.getUTCDay() };
}

/**
 * The instant a learner-local calendar day starts. `localDate` is the UTC-midnight label of that
 * day (as `getDateInTimeZone` returns it). The offset is read twice so a day that starts right
 * after a daylight-saving change still lands on its own midnight.
 */
export function getStartOfLocalDay({
  localDate,
  timeZone,
}: {
  localDate: Date;
  timeZone: string;
}): Date {
  const guess = new Date(localDate.getTime() - getTimeZoneOffsetMs({ date: localDate, timeZone }));
  return new Date(localDate.getTime() - getTimeZoneOffsetMs({ date: guess, timeZone }));
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
