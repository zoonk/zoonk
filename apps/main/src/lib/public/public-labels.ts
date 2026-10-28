import { type CourseLevel } from "@zoonk/db";
import { formatDuration } from "@zoonk/utils/duration";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getTotalDuration } from "./total-duration";

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;

export async function getMinutesFormatter(): Promise<(minutes: number) => string> {
  const locale = await getLocale();
  return (minutes) => formatDuration({ locale, totalSeconds: minutes * SECONDS_PER_MINUTE });
}

/** Read at UTC midnight so no time zone moves the day. */
export async function getIsoDayFormatter(): Promise<(isoDate: string) => string> {
  const format = await getFormatter();

  return (isoDate) =>
    format.dateTime(new Date(`${isoDate}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
}

export async function getTotalDurationFormatter(): Promise<(totalMinutes: number) => string> {
  const formatMinutes = await getMinutesFormatter();

  return (totalMinutes) => {
    const duration = getTotalDuration(Math.round(totalMinutes));

    return "minutes" in duration
      ? formatMinutes(duration.minutes)
      : `~${formatMinutes(duration.hours * MINUTES_PER_HOUR)}`;
  };
}

export async function getTotalDurationLabel(totalMinutes: number): Promise<string> {
  const durationText = await getTotalDurationFormatter();
  return durationText(totalMinutes);
}

/** Read once: looking each up on its own would run the translations inside `Promise.all`. */
export async function getLevelLabels(): Promise<Record<CourseLevel, string>> {
  const t = await getExtracted();

  return {
    advanced: t("Advanced"),
    beginner: t("Beginner"),
    intermediate: t("Intermediate"),
    overview: t("Overview"),
  };
}
