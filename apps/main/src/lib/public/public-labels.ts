import { type CourseLevel } from "@zoonk/db";
import { formatDuration } from "@zoonk/utils/duration";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getTotalDuration } from "./total-duration";

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;

/** Estimated lengths in minutes as the app's compact duration, like "5 min" or "1 hr 30 min". */
export async function getMinutesFormatter(): Promise<(minutes: number) => string> {
  const locale = await getLocale();
  return (minutes) => formatDuration({ locale, totalSeconds: minutes * SECONDS_PER_MINUTE });
}

/**
 * Calendar days as core sends them ("YYYY-MM-DD") written as their day and month, "Nov 8", read at
 * UTC midnight so no timezone moves them to another day.
 */
export async function getIsoDayFormatter(): Promise<(isoDate: string) => string> {
  const format = await getFormatter();

  return (isoDate) =>
    format.dateTime(new Date(`${isoDate}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
}

/**
 * How long a chapter, a course or a part of a plan takes, from its lessons' estimates
 * (`getTotalDuration`): read once, for a page that writes several.
 */
export async function getTotalDurationFormatter(): Promise<(totalMinutes: number) => string> {
  const t = await getExtracted();
  const formatMinutes = await getMinutesFormatter();

  return (totalMinutes) => {
    const duration = getTotalDuration(Math.round(totalMinutes));

    return "minutes" in duration
      ? formatMinutes(duration.minutes)
      : t("about {time}", { time: formatMinutes(duration.hours * MINUTES_PER_HOUR) });
  };
}

/**
 * A plan's time as its example writes it, beside its big numbers: its minutes under an hour, beyond
 * that the whole hours `getTotalDuration` rounds to, marked "~" as the estimate they are ("~3 h").
 */
export async function getApproxDurationFormatter(): Promise<(totalMinutes: number) => string> {
  const formatMinutes = await getMinutesFormatter();

  return (totalMinutes) => {
    const duration = getTotalDuration(Math.round(totalMinutes));

    return "minutes" in duration
      ? formatMinutes(duration.minutes)
      : `~${formatMinutes(duration.hours * MINUTES_PER_HOUR)}`;
  };
}

/** How long a chapter or course takes, from its lessons' estimates (`getTotalDuration`). */
export async function getTotalDurationLabel(totalMinutes: number): Promise<string> {
  const durationText = await getTotalDurationFormatter();
  return durationText(totalMinutes);
}

/**
 * The names of a course outline's level bands, read once for a page that names several: looking
 * each up on its own would run the translations inside `Promise.all`.
 */
export async function getLevelLabels(): Promise<Record<CourseLevel, string>> {
  const t = await getExtracted();

  return {
    advanced: t("Advanced"),
    beginner: t("Beginner"),
    intermediate: t("Intermediate"),
    overview: t("Overview"),
  };
}
