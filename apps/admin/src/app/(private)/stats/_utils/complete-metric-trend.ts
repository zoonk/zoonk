import { formatLabel } from "@zoonk/utils/chart";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

export type MetricTrendDataPoint = { date: string; label: string; value: number | null };

/**
 * Normalizes the first visible bucket because yearly and all-time charts use
 * month and year boundaries even when a custom range begins mid-period.
 */
function getFirstBucket({ date, period }: { date: Date; period: HistoryPeriod }): Date {
  if (period === "all") {
    return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }

  if (period === "year") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Advances by the interval represented on the selected chart so every missing
 * database bucket can be expressed deliberately instead of being bridged.
 */
function getNextBucket({ date, period }: { date: Date; period: HistoryPeriod }): Date {
  if (period === "all") {
    return new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
  }

  if (period === "year") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

/**
 * Builds the full visible time domain. Additive metrics pass zero because no
 * activity is a real zero; rates and averages pass null because no attempts or
 * completions means the value is unknown, not 0% or zero seconds.
 */
export function completeMetricTrend({
  dataPoints,
  emptyValue,
  end,
  period,
  start,
}: {
  dataPoints: { date: string; label: string; value: number }[];
  emptyValue: number | null;
  end: Date;
  period: HistoryPeriod;
  start: Date;
}): MetricTrendDataPoint[] {
  const values = new Map(dataPoints.map((point) => [point.date, point.value] as const));

  /**
   * Recursion expresses the immutable sequence without mutating an array or
   * reassigning a cursor as calendar buckets advance.
   */
  function buildBuckets(date: Date): MetricTrendDataPoint[] {
    if (date > end) {
      return [];
    }

    const dateKey = date.toISOString();

    const point = {
      date: dateKey,
      label: formatLabel(date, period, "en"),
      value: values.get(dateKey) ?? emptyValue,
    };

    return [point, ...buildBuckets(getNextBucket({ date, period }))];
  }

  return buildBuckets(getFirstBucket({ date: start, period }));
}
