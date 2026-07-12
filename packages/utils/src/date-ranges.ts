export const DEFAULT_PROGRESS_LOOKBACK_DAYS = 90;

const HISTORY_PERIODS = ["month", "6months", "year", "all"] as const;
const APP_LAUNCH_YEAR = 2025;
const MONTHS_PER_HALF_YEAR = 6;
const DECEMBER_INDEX = 11;
const LAST_DAY_OF_DECEMBER = 31;
const END_OF_DAY_HOURS = 23;
const END_OF_DAY_MINUTES = 59;
const END_OF_DAY_SECONDS = 59;
const END_OF_DAY_MS = 999;

export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

type DateRange = { start: Date; end: Date };
type DateRanges = { current: DateRange; previous: DateRange };

function isHistoryPeriod(value: string): value is HistoryPeriod {
  return (HISTORY_PERIODS as readonly string[]).includes(value);
}

export function validatePeriod(value: string): HistoryPeriod {
  return isHistoryPeriod(value) ? value : "month";
}

function endOfDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      END_OF_DAY_HOURS,
      END_OF_DAY_MINUTES,
      END_OF_DAY_SECONDS,
      END_OF_DAY_MS,
    ),
  );
}

function getMonthDateRanges(now: Date, offset: number): DateRanges {
  const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));

  const currentEnd = endOfDay(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 0)),
  );

  const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset - 1, 1));

  const previousEnd = endOfDay(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 0)),
  );

  return {
    current: { end: currentEnd, start: currentStart },
    previous: { end: previousEnd, start: previousStart },
  };
}

function getHalfYearDateRanges(now: Date, offset: number): DateRanges {
  const startMonth =
    (Math.floor(now.getUTCMonth() / MONTHS_PER_HALF_YEAR) - offset) * MONTHS_PER_HALF_YEAR;

  const currentStart = new Date(Date.UTC(now.getUTCFullYear(), startMonth, 1));

  const currentEnd = endOfDay(
    new Date(Date.UTC(now.getUTCFullYear(), startMonth + MONTHS_PER_HALF_YEAR, 0)),
  );

  const previousStart = new Date(
    Date.UTC(now.getUTCFullYear(), startMonth - MONTHS_PER_HALF_YEAR, 1),
  );

  const previousEnd = endOfDay(new Date(Date.UTC(now.getUTCFullYear(), startMonth, 0)));

  return {
    current: { end: currentEnd, start: currentStart },
    previous: { end: previousEnd, start: previousStart },
  };
}

function getYearDateRanges(now: Date, offset: number): DateRanges {
  const currentYear = now.getUTCFullYear() - offset;
  const currentStart = new Date(Date.UTC(currentYear, 0, 1));

  const currentEnd = endOfDay(
    new Date(Date.UTC(currentYear, DECEMBER_INDEX, LAST_DAY_OF_DECEMBER)),
  );

  const previousStart = new Date(Date.UTC(currentYear - 1, 0, 1));

  const previousEnd = endOfDay(
    new Date(Date.UTC(currentYear - 1, DECEMBER_INDEX, LAST_DAY_OF_DECEMBER)),
  );

  return {
    current: { end: currentEnd, start: currentStart },
    previous: { end: previousEnd, start: previousStart },
  };
}

/**
 * Keeps the all-time range anchored to the same request timestamp used by the
 * other calendar range calculations.
 */
function getAllDateRanges(now: Date): DateRanges {
  return {
    current: {
      end: endOfDay(new Date(Date.UTC(now.getUTCFullYear(), DECEMBER_INDEX, LAST_DAY_OF_DECEMBER))),
      start: new Date(Date.UTC(APP_LAUNCH_YEAR, 0, 1)),
    },
    previous: { end: new Date(0), start: new Date(0) },
  };
}

function getRangesForPeriod(period: HistoryPeriod, now: Date, offset: number): DateRanges {
  if (period === "month") {
    return getMonthDateRanges(now, offset);
  }

  if (period === "6months") {
    return getHalfYearDateRanges(now, offset);
  }

  return getYearDateRanges(now, offset);
}

function clampPreviousEnd(ranges: DateRanges, now: Date): DateRanges {
  const today = endOfDay(now);
  const elapsedMs = today.getTime() - ranges.current.start.getTime();
  const clampedEnd = new Date(ranges.previous.start.getTime() + elapsedMs);

  return {
    current: ranges.current,
    previous: {
      end: clampedEnd < ranges.previous.end ? clampedEnd : ranges.previous.end,
      start: ranges.previous.start,
    },
  };
}

/**
 * Uses one timestamp for both full and period-to-date ranges so a request at a
 * UTC calendar boundary cannot calculate its current and previous ranges from
 * different months or years.
 */
function getFullPeriodDateRanges({
  now,
  offset,
  period,
}: {
  now: Date;
  offset: number;
  period: HistoryPeriod;
}): DateRanges {
  if (period === "all") {
    return getAllDateRanges(now);
  }

  return getRangesForPeriod(period, now, offset);
}

/**
 * Returns complete calendar periods so an average can use the same previous
 * range that users see when they navigate back in a history chart.
 */
export function calculateFullPeriodDateRanges({
  offset,
  period,
}: {
  offset: number;
  period: HistoryPeriod;
}): DateRanges {
  return getFullPeriodDateRanges({ now: new Date(), offset, period });
}

/**
 * Keeps cumulative metric comparisons fair while a calendar period is still
 * in progress by limiting the previous range to the same elapsed duration.
 */
export function calculateDateRanges(period: HistoryPeriod, offset: number): DateRanges {
  const now = new Date();
  const ranges = getFullPeriodDateRanges({ now, offset, period });

  if (period === "all" || offset !== 0) {
    return ranges;
  }

  return clampPreviousEnd(ranges, now);
}

export function getDefaultStartDate(startDateIso?: string): Date {
  if (startDateIso) {
    return new Date(startDateIso);
  }

  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - DEFAULT_PROGRESS_LOOKBACK_DAYS,
    ),
  );
}

export function formatPeriodLabel(
  periodStart: Date,
  periodEnd: Date,
  period: HistoryPeriod,
  locale: string,
): string {
  if (period === "all") {
    return `${periodStart.getUTCFullYear()} - ${periodEnd.getUTCFullYear()}`;
  }

  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    }).format(periodStart);
  }

  if (period === "6months") {
    const startMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
      periodStart,
    );

    const endMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
      periodEnd,
    );

    return `${startMonth} - ${endMonth} ${periodStart.getUTCFullYear()}`;
  }

  return String(periodStart.getUTCFullYear());
}
