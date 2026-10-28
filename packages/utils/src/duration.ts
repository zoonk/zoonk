import { getNumberFormatter } from "./localized-number";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** A no-break space keeps each number with its unit, so "1 h 30 min" wraps only between units. */
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
