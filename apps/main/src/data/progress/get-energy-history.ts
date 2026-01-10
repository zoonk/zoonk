import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { getEnergyHistoryDaily } from "@zoonk/db/energy-history-daily";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type EnergyPeriod = "month" | "6months" | "year";

export type EnergyDataPoint = {
  date: Date;
  energy: number;
  label: string;
};

export type EnergyHistoryData = {
  dataPoints: EnergyDataPoint[];
  average: number;
  previousAverage: number | null;
  periodStart: Date;
  periodEnd: Date;
  hasPreviousPeriod: boolean;
  hasNextPeriod: boolean;
};

type DateRange = {
  start: Date;
  end: Date;
};

function calculateDateRanges(
  period: EnergyPeriod,
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

function formatLabel(date: Date, period: EnergyPeriod, locale: string): string {
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

function calculateAverage(dataPoints: { energy: number }[]): number {
  if (dataPoints.length === 0) {
    return 0;
  }
  const sum = dataPoints.reduce((acc, point) => acc + point.energy, 0);
  return sum / dataPoints.length;
}

const DAILY_DECAY = 1;

type RawDataPoint = { date: Date; energy: number };

function fillGapsWithDecay(dataPoints: RawDataPoint[]): RawDataPoint[] {
  const first = dataPoints[0];
  const last = dataPoints.at(-1);
  if (!(first && last)) {
    return [];
  }

  // Sort data points by date
  const sorted = [...dataPoints].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // Create a map of existing data points by date (YYYY-MM-DD)
  const dataMap = new Map<string, number>();
  for (const point of sorted) {
    const key = point.date.toISOString().split("T")[0] as string;
    dataMap.set(key, point.energy);
  }

  const result: RawDataPoint[] = [];
  const firstSorted = sorted[0];
  const lastSorted = sorted.at(-1);
  if (!(firstSorted && lastSorted)) {
    return [];
  }
  const firstDate = firstSorted.date;
  const lastDate = lastSorted.date;
  const current = new Date(firstDate);
  let previousEnergy: number | null = null;

  while (current <= lastDate) {
    const key = current.toISOString().split("T")[0] as string;
    const existingEnergy = dataMap.get(key);

    if (existingEnergy !== undefined) {
      result.push({ date: new Date(current), energy: existingEnergy });
      previousEnergy = existingEnergy;
    } else if (previousEnergy !== null) {
      const decayedEnergy = Math.max(0, previousEnergy - DAILY_DECAY);
      result.push({ date: new Date(current), energy: decayedEnergy });
      previousEnergy = decayedEnergy;
    }

    current.setDate(current.getDate() + 1);
  }

  return result;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Get Monday of this week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0] as string;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function aggregateByWeek(dataPoints: RawDataPoint[]): RawDataPoint[] {
  const weekMap = new Map<
    string,
    { total: number; count: number; date: Date }
  >();

  for (const point of dataPoints) {
    const key = getWeekKey(point.date);
    const existing = weekMap.get(key);
    if (existing) {
      existing.total += point.energy;
      existing.count += 1;
    } else {
      // Use the Monday of the week as the representative date
      const monday = new Date(point.date);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      weekMap.set(key, { count: 1, date: monday, total: point.energy });
    }
  }

  return Array.from(weekMap.values())
    .map((v) => ({ date: v.date, energy: v.total / v.count }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function aggregateByMonth(dataPoints: RawDataPoint[]): RawDataPoint[] {
  const monthMap = new Map<
    string,
    { total: number; count: number; date: Date }
  >();

  for (const point of dataPoints) {
    const key = getMonthKey(point.date);
    const existing = monthMap.get(key);
    if (existing) {
      existing.total += point.energy;
      existing.count += 1;
    } else {
      // Use the 1st of the month as the representative date
      const firstOfMonth = new Date(
        point.date.getFullYear(),
        point.date.getMonth(),
        1,
      );
      monthMap.set(key, { count: 1, date: firstOfMonth, total: point.energy });
    }
  }

  return Array.from(monthMap.values())
    .map((v) => ({ date: v.date, energy: v.total / v.count }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type EnergyHistoryParams = {
  period: EnergyPeriod;
  offset?: number;
  locale?: string;
  headers?: Headers;
};

async function fetchDailyData(
  userId: number,
  start: Date,
  end: Date,
): Promise<{ data: RawDataPoint[] | null; error: unknown }> {
  const result = await safeAsync(() =>
    prisma.$queryRawTyped(getEnergyHistoryDaily(userId, start, end)),
  );
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data.map((row) => ({ date: row.date, energy: row.energy })),
    error: null,
  };
}

function processEnergyData(
  rawData: RawDataPoint[],
  period: EnergyPeriod,
): RawDataPoint[] {
  // Always apply decay first
  const withDecay = fillGapsWithDecay(rawData);

  // Then aggregate based on period
  if (period === "6months") {
    return aggregateByWeek(withDecay);
  }

  if (period === "year") {
    return aggregateByMonth(withDecay);
  }

  return withDecay;
}

export const getEnergyHistory = cache(
  async (params: EnergyHistoryParams): Promise<EnergyHistoryData | null> => {
    const session = await getSession({ headers: params.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const { period, offset = 0, locale = "en" } = params;
    const { current, previous } = calculateDateRanges(period, offset);

    // Always fetch daily data, then apply decay and aggregate
    const [currentResult, previousResult] = await Promise.all([
      fetchDailyData(userId, current.start, current.end),
      fetchDailyData(userId, previous.start, previous.end),
    ]);

    if (currentResult.error || !currentResult.data) {
      return null;
    }

    const rawData = currentResult.data;

    if (rawData.length === 0) {
      return null;
    }

    // Apply decay first, then aggregate based on period
    const currentData = processEnergyData(rawData, period);

    const dataPoints: EnergyDataPoint[] = currentData.map((row) => ({
      date: row.date,
      energy: row.energy,
      label: formatLabel(row.date, period, locale),
    }));

    const average = calculateAverage(currentData);

    // Also apply decay to previous period for consistent comparison
    const previousRaw = previousResult.data ?? [];
    const previousData =
      previousRaw.length > 0 ? processEnergyData(previousRaw, period) : [];
    const previousAverage =
      previousData.length > 0 ? calculateAverage(previousData) : null;

    // Check if there's data before the current period
    const { data: earlierData } = await safeAsync(() =>
      prisma.dailyProgress.findFirst({
        select: { id: true },
        where: {
          date: { lt: current.start },
          userId,
        },
      }),
    );

    const hasPreviousPeriod = Boolean(earlierData);
    const hasNextPeriod = offset > 0;

    return {
      average,
      dataPoints,
      hasNextPeriod,
      hasPreviousPeriod,
      periodEnd: current.end,
      periodStart: current.start,
      previousAverage,
    };
  },
);
