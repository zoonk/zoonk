import "server-only";

export type HistoryPeriod = "month" | "6months" | "year";

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
    const currentStart = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1,
    );
    const currentEnd = new Date(
      now.getFullYear(),
      now.getMonth() - offset + 1,
      0,
    );
    const previousStart = new Date(
      now.getFullYear(),
      now.getMonth() - offset - 1,
      1,
    );
    const previousEnd = new Date(now.getFullYear(), now.getMonth() - offset, 0);

    return {
      current: { end: currentEnd, start: currentStart },
      previous: { end: previousEnd, start: previousStart },
    };
  }

  if (period === "6months") {
    const currentHalf = Math.floor(now.getMonth() / 6) - offset;
    const currentYear =
      now.getFullYear() + Math.floor((now.getMonth() - offset * 6) / 12);
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

export function formatLabel(
  date: Date,
  period: HistoryPeriod,
  locale: string,
): string {
  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }).format(date);
  }

  if (period === "6months") {
    const weekNum = Math.ceil(
      (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );
    return `W${weekNum}`;
  }

  // Year - show month name
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

export function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Get Monday of this week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0] as string;
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type BpDataPoint = { date: Date; bp: number };

export function aggregateBpByWeek(dataPoints: BpDataPoint[]): BpDataPoint[] {
  const weekMap = new Map<string, { total: number; date: Date }>();

  for (const point of dataPoints) {
    const key = getWeekKey(point.date);
    const existing = weekMap.get(key);
    if (existing) {
      existing.total += point.bp;
    } else {
      const monday = new Date(point.date);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      weekMap.set(key, { date: monday, total: point.bp });
    }
  }

  return Array.from(weekMap.values())
    .map((v) => ({ bp: v.total, date: v.date }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function aggregateBpByMonth(dataPoints: BpDataPoint[]): BpDataPoint[] {
  const monthMap = new Map<string, { total: number; date: Date }>();

  for (const point of dataPoints) {
    const key = getMonthKey(point.date);
    const existing = monthMap.get(key);
    if (existing) {
      existing.total += point.bp;
    } else {
      const firstOfMonth = new Date(
        point.date.getFullYear(),
        point.date.getMonth(),
        1,
      );
      monthMap.set(key, { date: firstOfMonth, total: point.bp });
    }
  }

  return Array.from(monthMap.values())
    .map((v) => ({ bp: v.total, date: v.date }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
