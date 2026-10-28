"use client";

import { formatDuration } from "@zoonk/utils/duration";
import { useFormatter, useLocale } from "next-intl";

const SECONDS_PER_MINUTE = 60;

export function useFormatDuration() {
  const locale = useLocale();

  return (totalMinutes: number): string =>
    formatDuration({ locale, totalSeconds: totalMinutes * SECONDS_PER_MINUTE });
}

/** Takes a time of day as "13:30". */
export function useFormatTimeOfDay() {
  const format = useFormatter();

  return (time: string): string =>
    format.dateTime(new Date(`1970-01-01T${time}:00.000Z`), {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
}
