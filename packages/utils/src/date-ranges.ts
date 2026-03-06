export const DEFAULT_PROGRESS_LOOKBACK_DAYS = 90;

const HISTORY_PERIODS = ["month", "6months", "year", "all"] as const;
const APP_LAUNCH_YEAR = 2025;
const MONTHS_PER_HALF_YEAR = 6;
const DECEMBER_INDEX = 11;
const LAST_DAY_OF_DECEMBER = 31;

export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

function isHistoryPeriod(value: string): value is HistoryPeriod {
  return (HISTORY_PERIODS as readonly string[]).includes(value);
}

export function validatePeriod(value: string): HistoryPeriod {
  return isHistoryPeriod(value) ? value : "month";
}

type DateRange = { start: Date; end: Date };
type DateRanges = { current: DateRange; previous: DateRange };

function getMonthDateRanges(now: Date, offset: number): DateRanges {
  const currentStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const currentEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - offset - 1, 1);
  const previousEnd = new Date(now.getFullYear(), now.getMonth() - offset, 0);

  return {
    current: { end: currentEnd, start: currentStart },
    previous: { end: previousEnd, start: previousStart },
  };
}

function getHalfYearDateRanges(now: Date, offset: number): DateRanges {
  const startMonth =
    (Math.floor(now.getMonth() / MONTHS_PER_HALF_YEAR) - offset) * MONTHS_PER_HALF_YEAR;

  const currentStart = new Date(now.getFullYear(), startMonth, 1);
  const currentEnd = new Date(now.getFullYear(), startMonth + MONTHS_PER_HALF_YEAR, 0);
  const previousStart = new Date(now.getFullYear(), startMonth - MONTHS_PER_HALF_YEAR, 1);
  const previousEnd = new Date(now.getFullYear(), startMonth, 0);

  return {
    current: { end: currentEnd, start: currentStart },
    previous: { end: previousEnd, start: previousStart },
  };
}

function getYearDateRanges(now: Date, offset: number): DateRanges {
  const currentYear = now.getFullYear() - offset;
  const currentStart = new Date(currentYear, 0, 1);
  const currentEnd = new Date(currentYear, DECEMBER_INDEX, LAST_DAY_OF_DECEMBER);
  const previousStart = new Date(currentYear - 1, 0, 1);
  const previousEnd = new Date(currentYear - 1, DECEMBER_INDEX, LAST_DAY_OF_DECEMBER);

  return {
    current: { end: currentEnd, start: currentStart },
    previous: { end: previousEnd, start: previousStart },
  };
}

function getAllDateRanges(): DateRanges {
  const now = new Date();

  return {
    current: {
      end: new Date(now.getFullYear(), DECEMBER_INDEX, LAST_DAY_OF_DECEMBER),
      start: new Date(APP_LAUNCH_YEAR, 0, 1),
    },
    previous: { end: new Date(0), start: new Date(0) },
  };
}

export function calculateDateRanges(period: HistoryPeriod, offset: number): DateRanges {
  if (period === "all") {
    return getAllDateRanges();
  }

  const now = new Date();

  if (period === "month") {
    return getMonthDateRanges(now, offset);
  }

  if (period === "6months") {
    return getHalfYearDateRanges(now, offset);
  }

  return getYearDateRanges(now, offset);
}

export function getDefaultStartDate(startDateIso?: string): Date {
  if (startDateIso) {
    return new Date(startDateIso);
  }
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - DEFAULT_PROGRESS_LOOKBACK_DAYS,
  );
}

export function formatPeriodLabel(
  periodStart: Date,
  periodEnd: Date,
  period: HistoryPeriod,
  locale: string,
): string {
  if (period === "all") {
    return `${periodStart.getFullYear()} - ${periodEnd.getFullYear()}`;
  }

  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(periodStart);
  }

  if (period === "6months") {
    const startMonth = new Intl.DateTimeFormat(locale, { month: "short" }).format(periodStart);
    const endMonth = new Intl.DateTimeFormat(locale, { month: "short" }).format(periodEnd);
    return `${startMonth} - ${endMonth} ${periodStart.getFullYear()}`;
  }

  return String(periodStart.getFullYear());
}
