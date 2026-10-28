const TIME_PERIOD_HOURS = [
  { end: 6, start: 0 },
  { end: 12, start: 6 },
  { end: 18, start: 12 },
  { end: 24, start: 18 },
] as const;

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

const HOURS_PER_DAY = 24;

type ClockHour = { hour: string; period: string | null };

function getClockHour({
  formatter,
  hour,
}: {
  formatter: Intl.DateTimeFormat;
  hour: number;
}): ClockHour {
  const hourCycle = formatter.resolvedOptions().hourCycle;

  if (hourCycle === "h23" || hourCycle === "h24") {
    return { hour: String(hour).padStart(2, "0"), period: null };
  }

  const parts = formatter.formatToParts(new Date(hour * MILLISECONDS_PER_HOUR));

  return {
    hour: parts.find((part) => part.type === "hour")?.value ?? String(hour % (HOURS_PER_DAY / 2)),
    period: parts.find((part) => part.type === "dayPeriod")?.value ?? null,
  };
}

/** Epoch-relative UTC hours keep the output independent from the server's time zone. */
export function getScoreTimePeriodRange({
  locale,
  period,
}: {
  locale: string;
  period: number;
}): string {
  const range = TIME_PERIOD_HOURS.at(period) ?? TIME_PERIOD_HOURS[0];
  const formatter = new Intl.DateTimeFormat(locale, { hour: "numeric", timeZone: "UTC" });
  const start = getClockHour({ formatter, hour: range.start });
  const end = getClockHour({ formatter, hour: range.end });

  if (!(start.period && end.period)) {
    return `${start.hour}–${end.hour}`;
  }

  if (start.period === end.period) {
    return `${start.hour}–${end.hour} ${end.period}`;
  }

  return `${start.hour} ${start.period}–${end.hour} ${end.period}`;
}
