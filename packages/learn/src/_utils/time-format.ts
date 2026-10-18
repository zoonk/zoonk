"use client";

import { formatDuration } from "@zoonk/utils/duration";
import { useFormatter, useLocale } from "next-intl";

const SECONDS_PER_MINUTE = 60;

/** A compact duration in the learner's locale, from minutes. */
export function useFormatDuration() {
  const locale = useLocale();

  return (totalMinutes: number): string =>
    formatDuration({ locale, totalSeconds: totalMinutes * SECONDS_PER_MINUTE });
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
