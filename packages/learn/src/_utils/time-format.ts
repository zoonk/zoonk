"use client";

import { formatDuration } from "@zoonk/utils/duration";
import { useExtracted, useFormatter } from "next-intl";
import { useAppLocale } from "./locale";

const SECONDS_PER_MINUTE = 60;

export function useFormatDuration() {
  const locale = useAppLocale();

  return (totalMinutes: number): string =>
    formatDuration({ locale, totalSeconds: totalMinutes * SECONDS_PER_MINUTE });
}

export function useStudyTimeFact(seconds: number): string | null {
  const t = useExtracted();
  const locale = useAppLocale();

  if (seconds <= 0) {
    return null;
  }

  return t("{time} studied", { time: formatDuration({ locale, totalSeconds: seconds }) });
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
