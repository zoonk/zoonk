export type TimePeriod = "week" | "month" | "year";

type TimePeriodConfig = {
  getKey: (date: Date) => string;
  getNormalizedDate: (date: Date) => Date;
};

const SUNDAY_DAYS_SINCE_MONDAY = 6;

function getMondayOfWeek(date: Date): Date {
  const monday = new Date(date);
  const dayOfWeek = monday.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? SUNDAY_DAYS_SINCE_MONDAY : dayOfWeek - 1;
  monday.setDate(date.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getFirstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getFirstOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function getWeekKey(date: Date): string {
  return getMondayOfWeek(date).toISOString().slice(0, 10);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getYearKey(date: Date): string {
  return date.getFullYear().toString();
}

const PERIOD_CONFIGS: Record<TimePeriod, TimePeriodConfig> = {
  month: { getKey: getMonthKey, getNormalizedDate: getFirstOfMonth },
  week: { getKey: getWeekKey, getNormalizedDate: getMondayOfWeek },
  year: { getKey: getYearKey, getNormalizedDate: getFirstOfYear },
};

type AggregationStrategy = "sum" | "average";

export function aggregateByPeriod<T extends { date: Date }>(
  dataPoints: T[],
  getValue: (point: T) => number,
  strategy: AggregationStrategy,
  period: TimePeriod,
): { date: Date; value: number }[] {
  const { getKey, getNormalizedDate } = PERIOD_CONFIGS[period];
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

type ScoreDataPoint = { date: Date; correct: number; incorrect: number };

export function aggregateScoreByPeriod(
  dataPoints: ScoreDataPoint[],
  calculateScore: (correct: number, incorrect: number) => number,
  period: TimePeriod,
): { date: Date; score: number }[] {
  const { getKey, getNormalizedDate } = PERIOD_CONFIGS[period];
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
