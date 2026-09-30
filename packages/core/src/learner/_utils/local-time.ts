import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, getHourInTimeZone } from "@zoonk/utils/time-zone";

const MS_PER_SECOND = 1000;

/** Learner-local date, hour and weekday of an instant, as `Attempt` stores them. */
export function getLocalAnswerTime({ date, timeZone }: { date: Date; timeZone: string }) {
  const localDate = getDateInTimeZone({ date, timeZone });

  return { hour: getHourInTimeZone({ date, timeZone }), localDate, weekday: localDate.getUTCDay() };
}

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value);
}

/** How far a timezone's wall clock is ahead of UTC at one instant, in milliseconds. */
function getTimeZoneOffsetMs({ date, timeZone }: { date: Date; timeZone: string }): number {
  const parts = new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    month: "numeric",
    second: "numeric",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

  const wallClock = Date.UTC(
    getDatePart(parts, "year"),
    getDatePart(parts, "month") - 1,
    getDatePart(parts, "day"),
    getDatePart(parts, "hour"),
    getDatePart(parts, "minute"),
    getDatePart(parts, "second"),
  );

  return wallClock - Math.floor(date.getTime() / MS_PER_SECOND) * MS_PER_SECOND;
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
