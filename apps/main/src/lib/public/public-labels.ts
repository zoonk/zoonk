import { type CourseLevel } from "@zoonk/db";
import { getExtracted } from "next-intl/server";

const MINUTES_PER_HOUR = 60;

/** A lesson's estimated length, like "5 min". */
export async function getMinutesLabel(minutes: number): Promise<string> {
  const t = await getExtracted();
  return t("{minutes, plural, one {# min} other {# min}}", { minutes });
}

/**
 * How long a chapter or course takes, from its lessons' estimates. Beyond an
 * hour it rounds to whole hours and says "about", since each lesson's time is
 * an estimate.
 */
export async function getTotalDurationLabel(totalMinutes: number): Promise<string> {
  if (totalMinutes < MINUTES_PER_HOUR) {
    return getMinutesLabel(totalMinutes);
  }

  const t = await getExtracted();
  const hours = Math.round(totalMinutes / MINUTES_PER_HOUR);

  return t("about {hours, plural, one {# hr} other {# hr}}", { hours });
}

/** The name of a level band in a course outline. */
export async function getLevelLabel(level: CourseLevel): Promise<string> {
  const t = await getExtracted();

  const labels: Record<CourseLevel, string> = {
    advanced: t("Advanced"),
    beginner: t("Beginner"),
    intermediate: t("Intermediate"),
    overview: t("Overview"),
  };

  return labels[level];
}
