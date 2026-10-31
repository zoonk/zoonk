const MS_PER_SECOND = 1000;

const DATE_PARTS = { day: "numeric", month: "numeric", year: "numeric" } as const;

const DATE_TIME_PARTS = {
  ...DATE_PARTS,
  hour: "numeric",
  hourCycle: "h23",
  minute: "numeric",
  second: "numeric",
} as const;

const HOUR_PARTS = { hour: "numeric", hourCycle: "h23" } as const;

function formatterCache(options: Intl.DateTimeFormatOptions) {
  const formatters = new Map<string, Intl.DateTimeFormat>();

  return (timeZone: string): Intl.DateTimeFormat => {
    const cached = formatters.get(timeZone);

    if (cached) {
      return cached;
    }

    const formatter = new Intl.DateTimeFormat("en", { ...options, timeZone });
    formatters.set(timeZone, formatter);
    return formatter;
  };
}

const dateFormatter = formatterCache(DATE_PARTS);
const dateTimeFormatter = formatterCache(DATE_TIME_PARTS);
const hourFormatter = formatterCache(HOUR_PARTS);

function getNumericDatePart({
  dateParts,
  type,
}: {
  dateParts: Intl.DateTimeFormatPart[];
  type: "day" | "hour" | "minute" | "month" | "second" | "year";
}): number {
  return Number(dateParts.find((part) => part.type === type)?.value);
}

/** The zone's calendar date as a UTC-midnight Date, the way Postgres date columns read. */
export function getDateInTimeZone({ date, timeZone }: { date: Date; timeZone: string }): Date {
  const dateParts = dateFormatter(timeZone).formatToParts(date);

  return new Date(
    Date.UTC(
      getNumericDatePart({ dateParts, type: "year" }),
      getNumericDatePart({ dateParts, type: "month" }) - 1,
      getNumericDatePart({ dateParts, type: "day" }),
    ),
  );
}

/** `hourCycle: "h23"` keeps midnight at 0, not 24. */
export function getHourInTimeZone({ date, timeZone }: { date: Date; timeZone: string }): number {
  const hour = hourFormatter(timeZone)
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;

  return Number(hour);
}

export function getTimeZoneOffsetMs({ date, timeZone }: { date: Date; timeZone: string }): number {
  const dateParts = dateTimeFormatter(timeZone).formatToParts(date);

  const wallClock = Date.UTC(
    getNumericDatePart({ dateParts, type: "year" }),
    getNumericDatePart({ dateParts, type: "month" }) - 1,
    getNumericDatePart({ dateParts, type: "day" }),
    getNumericDatePart({ dateParts, type: "hour" }),
    getNumericDatePart({ dateParts, type: "minute" }),
    getNumericDatePart({ dateParts, type: "second" }),
  );

  return wallClock - Math.floor(date.getTime() / MS_PER_SECOND) * MS_PER_SECOND;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone.length > 0;
  } catch {
    return false;
  }
}

export function getLocalTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
