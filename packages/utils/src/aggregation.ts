export type TimePeriod = "month" | "year";

type TimePeriodConfig = { getKey: (date: Date) => string; getNormalizedDate: (date: Date) => Date };

function getFirstOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getFirstOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getYearKey(date: Date): string {
  return date.getUTCFullYear().toString();
}

const PERIOD_CONFIGS: Record<TimePeriod, TimePeriodConfig> = {
  month: { getKey: getMonthKey, getNormalizedDate: getFirstOfMonth },
  year: { getKey: getYearKey, getNormalizedDate: getFirstOfYear },
};

export function aggregateByPeriod<T extends { date: Date }>(
  dataPoints: T[],
  getValue: (point: T) => number,
  period: TimePeriod,
): { date: Date; value: number }[] {
  const { getKey, getNormalizedDate } = PERIOD_CONFIGS[period];
  const map = new Map<string, { date: Date; value: number }>();

  for (const point of dataPoints) {
    const key = getKey(point.date);
    const existing = map.get(key);

    if (existing) {
      existing.value += getValue(point);
    } else {
      map.set(key, { date: getNormalizedDate(point.date), value: getValue(point) });
    }
  }

  return [...map.values()].toSorted((a, b) => a.date.getTime() - b.date.getTime());
}
