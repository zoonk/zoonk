import { MS_PER_DAY } from "@zoonk/utils/date";
import { getTimeZoneOffsetMs } from "@zoonk/utils/time-zone";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const SEND_WINDOW_MINUTES = 60;

function toMinuteOfDay(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

/**
 * A reminder may go out from its time until an hour later, never past local midnight, so a late
 * sweep doesn't send yesterday's reminder or one at bedtime.
 */
export function getReminderWindow({
  now,
  time,
  timeZone,
}: {
  now: Date;
  time: string;
  timeZone: string;
}): { endsAt: Date; localDate: Date; open: boolean } {
  const wallClock = now.getTime() + getTimeZoneOffsetMs({ date: now, timeZone });
  const localDate = new Date(Math.floor(wallClock / MS_PER_DAY) * MS_PER_DAY);
  const minute = (wallClock - localDate.getTime()) / MS_PER_MINUTE;
  const start = toMinuteOfDay(time);
  const end = Math.min(start + SEND_WINDOW_MINUTES, MINUTES_PER_DAY);

  return {
    endsAt: new Date(now.getTime() + (end - minute) * MS_PER_MINUTE),
    localDate,
    open: minute >= start && minute < end,
  };
}
