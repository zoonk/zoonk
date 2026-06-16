import { getExtracted } from "next-intl/server";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * Progress cards need a compact duration that still lets each locale choose
 * its own grammar. The card rounds to the nearest useful unit so learners see
 * "2 min" or "1 hr 30 min" instead of raw seconds from the database.
 */
export async function getProgressLearningTimeLabel({
  totalSeconds,
}: {
  totalSeconds: number;
}): Promise<string> {
  const t = await getExtracted();
  const roundedSeconds = Math.round(totalSeconds);

  if (roundedSeconds === 0) {
    return t("0 min");
  }

  if (roundedSeconds < SECONDS_PER_MINUTE) {
    return t("{seconds, plural, one {# sec} other {# sec}}", { seconds: roundedSeconds });
  }

  const roundedMinutes = Math.round(roundedSeconds / SECONDS_PER_MINUTE);

  if (roundedMinutes < MINUTES_PER_HOUR) {
    return t("{minutes, plural, one {# min} other {# min}}", { minutes: roundedMinutes });
  }

  const hours = Math.floor(roundedMinutes / MINUTES_PER_HOUR);
  const minutes = roundedMinutes % MINUTES_PER_HOUR;

  if (minutes === 0) {
    return t("{hours, plural, one {# hr} other {# hr}}", { hours });
  }

  return t(
    "{hours, plural, one {# hr} other {# hr}} {minutes, plural, one {# min} other {# min}}",
    { hours, minutes },
  );
}
