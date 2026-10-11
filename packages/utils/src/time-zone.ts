const MS_PER_SECOND = 1000;

/**
 * DateTimeFormat returns multiple part kinds, so this helper makes the required
 * calendar fields explicit before they become a UTC date-only value.
 */
function getNumericDatePart({
  dateParts,
  type,
}: {
  dateParts: Intl.DateTimeFormatPart[];
  type: "day" | "hour" | "minute" | "month" | "second" | "year";
}): number {
  return Number(dateParts.find((part) => part.type === type)?.value);
}

/**
 * Converts an instant into the UTC-midnight label for its calendar date in one
 * IANA timezone. Domain code can then compare Postgres date values without
 * introducing the server's timezone.
 */
export function getDateInTimeZone({ date, timeZone }: { date: Date; timeZone: string }): Date {
  const dateParts = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "numeric",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

  return new Date(
    Date.UTC(
      getNumericDatePart({ dateParts, type: "year" }),
      getNumericDatePart({ dateParts, type: "month" }) - 1,
      getNumericDatePart({ dateParts, type: "day" }),
    ),
  );
}

/**
 * Returns the 0-23 hour an instant falls in for one IANA timezone, so learner-local time-of-day
 * stats never depend on the server's timezone. `hourCycle: "h23"` keeps midnight at 0, not 24.
 */
export function getHourInTimeZone({ date, timeZone }: { date: Date; timeZone: string }): number {
  const hour = new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;

  return Number(hour);
}

/** How far a timezone's wall clock is ahead of UTC at one instant, in milliseconds. */
export function getTimeZoneOffsetMs({ date, timeZone }: { date: Date; timeZone: string }): number {
  const dateParts = new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    month: "numeric",
    second: "numeric",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

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

/**
 * Intl uses the runtime's timezone database as the source of truth. Constructing
 * a formatter is a small, deterministic way to reject forged or unsupported
 * timezone names before they reach calendar calculations.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone.length > 0;
  } catch {
    return false;
  }
}

/**
 * Reads the browser or host process timezone once at the point where a local
 * calendar event is created. UTC is a deterministic fallback for runtimes that
 * do not expose an IANA name.
 */
export function getLocalTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
