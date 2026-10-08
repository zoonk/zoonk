"use client";

import { useExtracted, useFormatter } from "next-intl";

const MINUTES_PER_HOUR = 60;

/** "2h 30m", "2h" or "45 min": how long something takes, from whole minutes. */
export function useFormatDuration() {
  const t = useExtracted();

  return (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    const minutes = totalMinutes % MINUTES_PER_HOUR;

    if (hours === 0) {
      return t("{minutes} min", { minutes: String(minutes) });
    }

    return minutes === 0
      ? t("{hours}h", { hours: String(hours) })
      : t("{hours}h {minutes}m", { hours: String(hours), minutes: String(minutes) });
  };
}

/** A time of day sent as "13:30", in the viewer's clock, like "1:30 PM". */
export function useFormatTimeOfDay() {
  const format = useFormatter();

  return (time: string): string =>
    format.dateTime(new Date(`1970-01-01T${time}:00.000Z`), {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
}
