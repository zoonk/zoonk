import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { getEnergyHistoryDaily } from "@zoonk/db/energy-history-daily";
import { getEnergyHistoryMonthly } from "@zoonk/db/energy-history-monthly";
import { getEnergyHistoryWeekly } from "@zoonk/db/energy-history-weekly";
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

export type EnergyHistoryParams = {
  period: EnergyPeriod;
  offset?: number;
  locale?: string;
  headers?: Headers;
};

type RawDataPoint = { date: Date; energy: number };

async function fetchEnergyData(
  userId: number,
  period: EnergyPeriod,
  start: Date,
  end: Date,
): Promise<{ data: RawDataPoint[] | null; error: unknown }> {
  if (period === "month") {
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

  if (period === "6months") {
    const result = await safeAsync(() =>
      prisma.$queryRawTyped(getEnergyHistoryWeekly(userId, start, end)),
    );
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }
    return {
      data: result.data
        .filter((row) => row.weekStart !== null && row.energy !== null)
        .map((row) => ({
          date: row.weekStart as Date,
          energy: row.energy as number,
        })),
      error: null,
    };
  }

  // Year
  const result = await safeAsync(() =>
    prisma.$queryRawTyped(getEnergyHistoryMonthly(userId, start, end)),
  );
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data
      .filter((row) => row.monthStart !== null && row.energy !== null)
      .map((row) => ({
        date: row.monthStart as Date,
        energy: row.energy as number,
      })),
    error: null,
  };
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

    const [currentResult, previousResult] = await Promise.all([
      fetchEnergyData(userId, period, current.start, current.end),
      fetchEnergyData(userId, period, previous.start, previous.end),
    ]);

    if (currentResult.error || !currentResult.data) {
      return null;
    }

    const currentData = currentResult.data;

    if (currentData.length === 0) {
      return null;
    }

    const dataPoints: EnergyDataPoint[] = currentData.map((row) => ({
      date: row.date,
      energy: row.energy,
      label: formatLabel(row.date, period, locale),
    }));

    const average = calculateAverage(currentData);

    const previousData = previousResult.data ?? [];
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
