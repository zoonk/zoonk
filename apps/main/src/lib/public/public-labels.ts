import { getAppLocale } from "@/i18n/locale";
import { type CourseLevel } from "@zoonk/db";
import { formatIsoDate } from "@zoonk/utils/date-format";
import { formatDuration } from "@zoonk/utils/duration";
import { getExtracted } from "next-intl/server";
import { getTotalDuration } from "./total-duration";

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;

export async function getMinutesFormatter(): Promise<(minutes: number) => string> {
  const locale = await getAppLocale();
  return (minutes) => formatDuration({ locale, totalSeconds: minutes * SECONDS_PER_MINUTE });
}

/** A data row's date on a public page; a day in another year than `today` names it. */
export async function getIsoDayFormatter(today: string): Promise<(isoDate: string) => string> {
  const locale = await getAppLocale();
  return (isoDate) => formatIsoDate({ isoDate, locale, today });
}

export async function getTotalDurationLabel(totalMinutes: number): Promise<string> {
  const formatMinutes = await getMinutesFormatter();
  const duration = getTotalDuration(Math.round(totalMinutes));

  return "minutes" in duration
    ? formatMinutes(duration.minutes)
    : `~${formatMinutes(duration.hours * MINUTES_PER_HOUR)}`;
}

/** Read once: looking each up on its own would run the translations inside `Promise.all`. */
export async function getLevelLabels(locale?: string): Promise<Record<CourseLevel, string>> {
  const t = await getExtracted(locale === undefined ? undefined : { locale });

  return {
    advanced: t("Advanced"),
    beginner: t("Beginner"),
    intermediate: t("Intermediate"),
    overview: t("Overview"),
  };
}
