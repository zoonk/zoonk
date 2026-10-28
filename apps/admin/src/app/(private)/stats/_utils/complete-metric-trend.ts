import { formatLabel } from "@zoonk/utils/chart";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

export type MetricTrendDataPoint = { date: string; label: string; value: number | null };
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function getFirstBucket({ date, period }: { date: Date; period: HistoryPeriod }): Date {
  if (period === "all") {
    return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }

  if (period === "year") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getBucketAtIndex({
  firstBucket,
  index,
  period,
}: {
  firstBucket: Date;
  index: number;
  period: HistoryPeriod;
}): Date {
  if (period === "all") {
    return new Date(Date.UTC(firstBucket.getUTCFullYear() + index, 0, 1));
  }

  if (period === "year") {
    return new Date(Date.UTC(firstBucket.getUTCFullYear(), firstBucket.getUTCMonth() + index, 1));
  }

  return new Date(
    Date.UTC(
      firstBucket.getUTCFullYear(),
      firstBucket.getUTCMonth(),
      firstBucket.getUTCDate() + index,
    ),
  );
}

function getBucketCount({
  end,
  firstBucket,
  period,
}: {
  end: Date;
  firstBucket: Date;
  period: HistoryPeriod;
}): number {
  if (period === "all") {
    return end.getUTCFullYear() - firstBucket.getUTCFullYear() + 1;
  }

  if (period === "year") {
    const yearDifference = end.getUTCFullYear() - firstBucket.getUTCFullYear();
    return yearDifference * 12 + end.getUTCMonth() - firstBucket.getUTCMonth() + 1;
  }

  return Math.floor((end.getTime() - firstBucket.getTime()) / MILLISECONDS_PER_DAY) + 1;
}

/** Additive metrics pass zero, a real zero; rates and averages pass null, since no data isn't 0%. */
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
  const firstBucket = getFirstBucket({ date: start, period });
  const bucketCount = getBucketCount({ end, firstBucket, period });

  return Array.from({ length: bucketCount }, (_, index) => {
    const date = getBucketAtIndex({ firstBucket, index, period });
    const dateKey = date.toISOString();

    return {
      date: dateKey,
      label: formatLabel(date, period, "en"),
      value: values.get(dateKey) ?? emptyValue,
    };
  });
}
