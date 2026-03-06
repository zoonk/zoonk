import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "./constants";

const HISTORY_PERIODS = ["month", "6months", "year", "all"] as const;

const APP_LAUNCH_YEAR = 2025;

const MONTHS_PER_HALF_YEAR = 6;
const DECEMBER_INDEX = 11;
const LAST_DAY_OF_DECEMBER = 31;
const SUNDAY_TO_MONDAY_OFFSET = -6;
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

function isHistoryPeriod(value: string): value is HistoryPeriod {
  return (HISTORY_PERIODS as readonly string[]).includes(value);
}

export function validatePeriod(value: string): HistoryPeriod {
  return isHistoryPeriod(value) ? value : "month";
}

type DateRange = {
  start: Date;
  end: Date;
};

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
  const currentHalf = Math.floor(now.getMonth() / MONTHS_PER_HALF_YEAR) - offset;
  const currentYear =
    now.getFullYear() + Math.floor((now.getMonth() - offset * MONTHS_PER_HALF_YEAR) / 12);
  const normalizedHalf = ((currentHalf % 2) + 2) % 2;

  const currentStartMonth = normalizedHalf * MONTHS_PER_HALF_YEAR;
  const currentStart = new Date(currentYear, currentStartMonth, 1);
  const currentEnd = new Date(currentYear, currentStartMonth + MONTHS_PER_HALF_YEAR, 0);

  const previousHalf = normalizedHalf === 0 ? 1 : 0;
  const previousYear = normalizedHalf === 0 ? currentYear - 1 : currentYear;
  const previousStartMonth = previousHalf * MONTHS_PER_HALF_YEAR;
  const previousStart = new Date(previousYear, previousStartMonth, 1);
  const previousEnd = new Date(previousYear, previousStartMonth + MONTHS_PER_HALF_YEAR, 0);

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

export function formatLabel(date: Date, period: HistoryPeriod, locale: string): string {
  if (period === "all") {
    return date.getFullYear().toString();
  }

  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }).format(date);
  }

  if (period === "6months") {
    const weekNum = Math.ceil(
      (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / MILLISECONDS_PER_WEEK,
    );
    return `W${weekNum}`;
  }

  // Year - show month name
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

function getMondayOfWeek(date: Date): Date {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? SUNDAY_TO_MONDAY_OFFSET : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getFirstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getWeekKey(date: Date): string {
  return getMondayOfWeek(date).toISOString().slice(0, 10);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type TimePeriodConfig = {
  getKey: (date: Date) => string;
  getNormalizedDate: (date: Date) => Date;
};

function getYearKey(date: Date): string {
  return date.getFullYear().toString();
}

function getFirstOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

const weekConfig: TimePeriodConfig = { getKey: getWeekKey, getNormalizedDate: getMondayOfWeek };
const monthConfig: TimePeriodConfig = { getKey: getMonthKey, getNormalizedDate: getFirstOfMonth };
const yearConfig: TimePeriodConfig = { getKey: getYearKey, getNormalizedDate: getFirstOfYear };

type AggregationStrategy = "sum" | "average";

function aggregateByPeriod<T extends { date: Date }>(
  dataPoints: T[],
  getValue: (point: T) => number,
  strategy: AggregationStrategy,
  { getKey, getNormalizedDate }: TimePeriodConfig,
): { date: Date; value: number }[] {
  const map = new Map<string, { total: number; count: number; date: Date }>();

  for (const point of dataPoints) {
    const key = getKey(point.date);
    const existing = map.get(key);
    if (existing) {
      existing.total += getValue(point);
      existing.count += 1;
    } else {
      map.set(key, {
        count: 1,
        date: getNormalizedDate(point.date),
        total: getValue(point),
      });
    }
  }

  return [...map.values()]
    .map((item) => ({
      date: item.date,
      value: strategy === "sum" ? item.total : item.total / item.count,
    }))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

export function aggregateByWeek<T extends { date: Date }>(
  dataPoints: T[],
  getValue: (point: T) => number,
  strategy: AggregationStrategy,
): { date: Date; value: number }[] {
  return aggregateByPeriod(dataPoints, getValue, strategy, weekConfig);
}

export function aggregateByMonth<T extends { date: Date }>(
  dataPoints: T[],
  getValue: (point: T) => number,
  strategy: AggregationStrategy,
): { date: Date; value: number }[] {
  return aggregateByPeriod(dataPoints, getValue, strategy, monthConfig);
}

export function aggregateByYear<T extends { date: Date }>(
  dataPoints: T[],
  getValue: (point: T) => number,
  strategy: AggregationStrategy,
): { date: Date; value: number }[] {
  return aggregateByPeriod(dataPoints, getValue, strategy, yearConfig);
}

type ScoreDataPoint = { date: Date; correct: number; incorrect: number };

function aggregateScoreByPeriod(
  dataPoints: ScoreDataPoint[],
  calculateScore: (correct: number, incorrect: number) => number,
  { getKey, getNormalizedDate }: TimePeriodConfig,
): { date: Date; score: number }[] {
  const map = new Map<string, { correct: number; incorrect: number; date: Date }>();

  for (const point of dataPoints) {
    const key = getKey(point.date);
    const existing = map.get(key);
    if (existing) {
      existing.correct += point.correct;
      existing.incorrect += point.incorrect;
    } else {
      map.set(key, {
        correct: point.correct,
        date: getNormalizedDate(point.date),
        incorrect: point.incorrect,
      });
    }
  }

  return [...map.values()]
    .map((item) => ({
      date: item.date,
      score: calculateScore(item.correct, item.incorrect),
    }))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

export function aggregateScoreByWeek(
  dataPoints: ScoreDataPoint[],
  calculateScore: (correct: number, incorrect: number) => number,
): { date: Date; score: number }[] {
  return aggregateScoreByPeriod(dataPoints, calculateScore, weekConfig);
}

export function aggregateScoreByMonth(
  dataPoints: ScoreDataPoint[],
  calculateScore: (correct: number, incorrect: number) => number,
): { date: Date; score: number }[] {
  return aggregateScoreByPeriod(dataPoints, calculateScore, monthConfig);
}

export function aggregateScoreByYear(
  dataPoints: ScoreDataPoint[],
  calculateScore: (correct: number, incorrect: number) => number,
): { date: Date; score: number }[] {
  return aggregateScoreByPeriod(dataPoints, calculateScore, yearConfig);
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

export function buildChartData(
  rawPoints: { date: Date; count: number }[],
  period: HistoryPeriod,
  locale: string,
): { average: number; dataPoints: { date: string; label: string; value: number }[] } {
  if (rawPoints.length === 0) {
    return { average: 0, dataPoints: [] };
  }

  const aggregated = getAggregatedPoints(rawPoints, period);

  const dataPoints = aggregated.map((point) => ({
    date: point.date.toISOString(),
    label: formatLabel(point.date, period, locale),
    value: point.value,
  }));

  const average = Math.round(
    dataPoints.reduce((sum, point) => sum + point.value, 0) / dataPoints.length,
  );

  return { average, dataPoints };
}

function getAggregatedPoints(
  rawPoints: { date: Date; count: number }[],
  period: HistoryPeriod,
): { date: Date; value: number }[] {
  if (period === "all") {
    return aggregateByYear(rawPoints, (point) => point.count, "sum");
  }

  if (period === "6months") {
    return aggregateByWeek(rawPoints, (point) => point.count, "sum");
  }

  if (period === "year") {
    return aggregateByMonth(rawPoints, (point) => point.count, "sum");
  }

  return rawPoints.map((point) => ({ date: point.date, value: point.count }));
}

export type ScoredRow = { key: number; correct: number; incorrect: number };

export function findBestByScore(rows: ScoredRow[]): { key: number; score: number } | null {
  const scored = rows
    .filter((row) => row.correct + row.incorrect > 0)
    .map((row) => {
      const total = row.correct + row.incorrect;
      return { key: row.key, score: (row.correct / total) * 100, total };
    });

  const best = scored.toSorted((a, b) => b.score - a.score || b.total - a.total).at(0);

  if (!best) {
    return null;
  }

  return { key: best.key, score: best.score };
}
