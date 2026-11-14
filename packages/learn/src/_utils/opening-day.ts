import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";

/** When something opens again: already `open`, today, tomorrow, or a later day as its ISO date. */
export type OpeningDay = string;

/** Which day in `timeZone` holds the server's instant, or `open` once it has passed; null when it can't be read. */
export function toOpeningDay({
  availableAt,
  now,
  timeZone,
}: {
  availableAt: string | null;
  now: Date;
  timeZone: string;
}): OpeningDay | null {
  const opens = availableAt ? new Date(availableAt) : null;

  if (!opens || Number.isNaN(opens.getTime())) {
    return null;
  }

  if (opens.getTime() <= now.getTime()) {
    return "open";
  }

  const today = getDateInTimeZone({ date: now, timeZone });
  const day = getDateInTimeZone({ date: opens, timeZone });
  const daysAway = Math.round((day.getTime() - today.getTime()) / MS_PER_DAY);

  if (daysAway <= 0) {
    return "today";
  }

  return daysAway === 1 ? "tomorrow" : day.toISOString().slice(0, "YYYY-MM-DD".length);
}

function nextLocalMidnight(now: number): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

/**
 * Calls `notify` whenever the day's name can change: at each local midnight before the instant
 * ("tomorrow" becomes "today") and when it passes. One timer, set again after each wake.
 */
export function watchOpeningClock(availableAt: string | null, notify: () => void): () => void {
  const opens = availableAt ? Date.parse(availableAt) : Number.NaN;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const wait = () => {
    const now = Date.now();

    if (opens > now) {
      timer = setTimeout(
        () => {
          notify();
          wait();
        },
        Math.min(opens, nextLocalMidnight(now)) - now,
      );
    }
  };

  wait();
  return () => clearTimeout(timer);
}
