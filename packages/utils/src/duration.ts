import { getNumberFormatter } from "./localized-number";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * One number with its unit, kept on one line: the locale's plain space becomes a no-break space,
 * so a narrow chip wraps "1 h 30 min" between its units, never as "1 h 30" over "min". The narrow
 * no-break spaces some locales already use (French "2 h") stay as they are.
 */
function formatUnit({
  locale,
  unit,
  value,
}: {
  locale: string;
  unit: "hour" | "minute" | "second";
  value: number;
}): string {
  return getNumberFormatter(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    useGrouping: false,
  })
    .format(value)
    .replaceAll(" ", "\u00A0");
}

/**
 * Compact learning time, rounded to seconds below a minute and minutes above it. Hours and minutes
 * are joined by a plain space, the one place a line may break.
 */
export function formatDuration({
  locale,
  totalSeconds,
}: {
  locale: string;
  totalSeconds: number;
}): string {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;

  if (seconds === 0) {
    return formatUnit({ locale, unit: "minute", value: 0 });
  }

  if (seconds < SECONDS_PER_MINUTE) {
    return formatUnit({ locale, unit: "second", value: seconds });
  }

  const totalMinutes = Math.round(seconds / SECONDS_PER_MINUTE);

  if (totalMinutes < MINUTES_PER_HOUR) {
    return formatUnit({ locale, unit: "minute", value: totalMinutes });
  }

  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const formattedHours = formatUnit({ locale, unit: "hour", value: hours });

  return minutes === 0
    ? formattedHours
    : `${formattedHours} ${formatUnit({ locale, unit: "minute", value: minutes })}`;
}
