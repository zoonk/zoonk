const SUNDAY_TO_MONDAY_OFFSET = -6;

type TimePeriodConfig = {
  getKey: (date: Date) => string;
  getNormalizedDate: (date: Date) => Date;
};

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
