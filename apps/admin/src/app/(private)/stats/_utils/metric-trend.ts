import { buildChartData } from "@zoonk/utils/chart";
import { type MetricTrendDataPoint, completeMetricTrend } from "./complete-metric-trend";
import { type StatsPeriod } from "./stats-period";

const PERCENT = 100;

type TrendPoint = { count: number; date: Date };

/**
 * Turns database buckets into the full visible series of the selected period. Additive metrics
 * pass zero for empty buckets; rates and averages pass null, since no data isn't 0%.
 */
export function buildMetricTrend({
  emptyValue,
  points,
  statsPeriod,
}: {
  emptyValue: number | null;
  points: readonly TrendPoint[];
  statsPeriod: StatsPeriod;
}): MetricTrendDataPoint[] {
  return completeMetricTrend({
    dataPoints: buildChartData([...points], statsPeriod.chartPeriod, "en"),
    emptyValue,
    end: statsPeriod.chartEnd,
    period: statsPeriod.chartPeriod,
    start: statsPeriod.current.start,
  });
}

/** A share in percent, or null when there's nothing to divide by. */
export function toPercent({
  denominator,
  numerator,
}: {
  denominator: number;
  numerator: number;
}): number | null {
  return denominator > 0 ? (numerator / denominator) * PERCENT : null;
}

/** Rate points for the buckets that have a denominator; the others stay empty on the chart. */
export function toRatePoints<Row extends { date: Date }>({
  denominator,
  numerator,
  rows,
}: {
  denominator: (row: Row) => number;
  numerator: (row: Row) => number;
  rows: readonly Row[];
}): TrendPoint[] {
  return rows.flatMap((row) => {
    const rate = toPercent({ denominator: denominator(row), numerator: numerator(row) });
    return rate === null ? [] : [{ count: rate, date: row.date }];
  });
}

export function sumRows<Row>({
  rows,
  value,
}: {
  rows: readonly Row[];
  value: (row: Row) => number;
}): number {
  return rows.reduce((sum, row) => sum + value(row), 0);
}
