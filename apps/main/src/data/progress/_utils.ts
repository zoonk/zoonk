import "server-only";

const HISTORY_PERIODS = ["month", "6months", "year"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

function isHistoryPeriod(value: string): value is HistoryPeriod {
  return HISTORY_PERIODS.some((v) => v === value);
}

export function validatePeriod(value: string): HistoryPeriod {
  return isHistoryPeriod(value) ? value : "month";
}

export type DateRange = {
  start: Date;
  end: Date;
};

export function calculateDateRanges(
  period: HistoryPeriod,
  offset: number,
): { current: DateRange; previous: DateRange } {
  const now = new Date();

  if (period === "month") {
    const currentStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const currentEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
    const previousStart = new Date(now.getFullYear(), now.getMonth() - offset - 1, 1);
    const previousEnd = new Date(now.getFullYear(), now.getMonth() - offset, 0);

    return {
      current: { end: currentEnd, start: currentStart },
      previous: { end: previousEnd, start: previousStart },
    };
  }

  if (period === "6months") {
    const currentHalf = Math.floor(now.getMonth() / 6) - offset;
    const currentYear = now.getFullYear() + Math.floor((now.getMonth() - offset * 6) / 12);
    const normalizedHalf = ((currentHalf % 2) + 2) % 2;

    const currentStartMonth = normalizedHalf * 6;
    const currentStart = new Date(currentYear, currentStartMonth, 1);
    const currentEnd = new Date(currentYear, currentStartMonth + 6, 0);

    const previousHalf = normalizedHalf === 0 ? 1 : 0;
    const previousYear = normalizedHalf === 0 ? currentYear - 1 : currentYear;
    const previousStartMonth = previousHalf * 6;
    const previousStart = new Date(previousYear, previousStartMonth, 1);
    const previousEnd = new Date(previousYear, previousStartMonth + 6, 0);

    return {
      current: { end: currentEnd, start: currentStart },
      previous: { end: previousEnd, start: previousStart },
    };
  }

  // Year
  const currentYear = now.getFullYear() - offset;
  const currentStart = new Date(currentYear, 0, 1);
  const currentEnd = new Date(currentYear, 11, 31);
  const previousStart = new Date(currentYear - 1, 0, 1);
  const previousEnd = new Date(currentYear - 1, 11, 31);

  return {
    current: { end: currentEnd, start: currentStart },
    previous: { end: previousEnd, start: previousStart },
  };
}

export function formatLabel(date: Date, period: HistoryPeriod, locale: string): string {
  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }).format(date);
  }

  if (period === "6months") {
    const weekNum = Math.ceil(
      (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    return `W${weekNum}`;
  }

  // Year - show month name
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Get Monday of this week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().substring(0, 10);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMondayOfWeek(date: Date): Date {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getFirstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

type AggregationStrategy = "sum" | "average";

export function aggregateByWeek<T extends { date: Date }>(
  dataPoints: T[],
  getValue: (point: T) => number,
  strategy: AggregationStrategy,
): { date: Date; value: number }[] {
  const map = new Map<string, { total: number; count: number; date: Date }>();

  for (const point of dataPoints) {
    const key = getWeekKey(point.date);
    const existing = map.get(key);
    if (existing) {
      existing.total += getValue(point);
      existing.count += 1;
    } else {
      map.set(key, {
        count: 1,
        date: getMondayOfWeek(point.date),
        total: getValue(point),
      });
    }
  }

  return Array.from(map.values())
    .map((v) => ({
      date: v.date,
      value: strategy === "sum" ? v.total : v.total / v.count,
    }))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

export function aggregateByMonth<T extends { date: Date }>(
  dataPoints: T[],
  getValue: (point: T) => number,
  strategy: AggregationStrategy,
): { date: Date; value: number }[] {
  const map = new Map<string, { total: number; count: number; date: Date }>();

  for (const point of dataPoints) {
    const key = getMonthKey(point.date);
    const existing = map.get(key);
    if (existing) {
      existing.total += getValue(point);
      existing.count += 1;
    } else {
      map.set(key, {
        count: 1,
        date: getFirstOfMonth(point.date),
        total: getValue(point),
      });
    }
  }

  return Array.from(map.values())
    .map((v) => ({
      date: v.date,
      value: strategy === "sum" ? v.total : v.total / v.count,
    }))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

type ScoreDataPoint = { date: Date; correct: number; incorrect: number };

export function aggregateScoreByWeek(
  dataPoints: ScoreDataPoint[],
  calculateScore: (correct: number, incorrect: number) => number,
): { date: Date; score: number }[] {
  const map = new Map<string, { correct: number; incorrect: number; date: Date }>();

  for (const point of dataPoints) {
    const key = getWeekKey(point.date);
    const existing = map.get(key);
    if (existing) {
      existing.correct += point.correct;
      existing.incorrect += point.incorrect;
    } else {
      map.set(key, {
        correct: point.correct,
        date: getMondayOfWeek(point.date),
        incorrect: point.incorrect,
      });
    }
  }

  return Array.from(map.values())
    .map((v) => ({
      date: v.date,
      score: calculateScore(v.correct, v.incorrect),
    }))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

export function aggregateScoreByMonth(
  dataPoints: ScoreDataPoint[],
  calculateScore: (correct: number, incorrect: number) => number,
): { date: Date; score: number }[] {
  const map = new Map<string, { correct: number; incorrect: number; date: Date }>();

  for (const point of dataPoints) {
    const key = getMonthKey(point.date);
    const existing = map.get(key);
    if (existing) {
      existing.correct += point.correct;
      existing.incorrect += point.incorrect;
    } else {
      map.set(key, {
        correct: point.correct,
        date: getFirstOfMonth(point.date),
        incorrect: point.incorrect,
      });
    }
  }

  return Array.from(map.values())
    .map((v) => ({
      date: v.date,
      score: calculateScore(v.correct, v.incorrect),
    }))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
}
