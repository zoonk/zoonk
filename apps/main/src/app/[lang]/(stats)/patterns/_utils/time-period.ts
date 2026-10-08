const TIME_PERIOD_HOURS = [
  { end: 6, start: 0 },
  { end: 12, start: 6 },
  { end: 18, start: 12 },
  { end: 24, start: 18 },
] as const;

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

/**
 * Keeps 24-hour locale output aligned to the familiar two-digit clock while
 * preserving each locale's own separators and 12-hour day-period markers.
 */
function formatScoreTime({
  date,
  formatter,
}: {
  date: Date;
  formatter: Intl.DateTimeFormat;
}): string {
  const hourCycle = formatter.resolvedOptions().hourCycle;
  const usesTwentyFourHourClock = hourCycle === "h23" || hourCycle === "h24";

  if (!usesTwentyFourHourClock) {
    return formatter.format(date);
  }

  return formatter
    .formatToParts(date)
    .map((part) => (part.type === "hour" ? part.value.padStart(2, "0") : part.value))
    .join("");
}

/**
 * Formats the fixed product dayparts as clock ranges in the learner's locale.
 * Epoch-relative UTC offsets keep the calendar irrelevant and the output
 * independent from the server timezone, including Evening's midnight endpoint.
 */
export function getScoreTimePeriodRange({
  locale,
  period,
}: {
  locale: string;
  period: number;
}): string {
  const range = TIME_PERIOD_HOURS.at(period) ?? TIME_PERIOD_HOURS[0];

  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const start = new Date(range.start * MILLISECONDS_PER_HOUR);
  const end = new Date(range.end * MILLISECONDS_PER_HOUR);

  return `${formatScoreTime({ date: start, formatter })}–${formatScoreTime({ date: end, formatter })}`;
}
