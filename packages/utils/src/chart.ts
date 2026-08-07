import { aggregateByPeriod } from "./aggregation";
import { type HistoryPeriod } from "./date-ranges";

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
    return date.getUTCFullYear().toString();
  }

  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(date);
  }

  // Year - show month name
  return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date);
}

function getAggregatedPoints(
  rawPoints: { date: Date; count: number }[],
  period: HistoryPeriod,
): { date: Date; value: number }[] {
  if (period === "all") {
    return aggregateByPeriod(rawPoints, (point) => point.count, "sum", "year");
  }

  if (period === "year") {
    return aggregateByPeriod(rawPoints, (point) => point.count, "sum", "month");
  }

  return rawPoints.map((point) => ({ date: point.date, value: point.count }));
}

export function buildChartData(
  rawPoints: { date: Date; count: number }[],
  period: HistoryPeriod,
  locale: string,
): { date: string; label: string; value: number }[] {
  if (rawPoints.length === 0) {
    return [];
  }

  const aggregated = getAggregatedPoints(rawPoints, period);

  return aggregated.map((point) => ({
    date: point.date.toISOString(),
    label: formatLabel(point.date, period, locale),
    value: point.value,
  }));
}
