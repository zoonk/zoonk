import { aggregateByMonth, aggregateByWeek, aggregateByYear } from "./aggregation";
import { type HistoryPeriod } from "./date-ranges";

const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function isValidChartPayload<T>(
  payload: unknown,
): payload is [{ payload: T }, ...{ payload: T }[]] {
  if (!Array.isArray(payload) || payload.length === 0) {
    return false;
  }

  const first: unknown = payload[0];

  return typeof first === "object" && first !== null && "payload" in first;
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
