import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import {
  aggregateByMonth,
  aggregateByWeek,
  calculateDateRanges,
  formatLabel,
  type HistoryPeriod,
} from "./_utils";

export type EnergyPeriod = HistoryPeriod;

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
  const sorted = [...dataPoints].toSorted((a, b) => a.date.getTime() - b.date.getTime());

  // Create a map of existing data points by date (YYYY-MM-DD)
  const dataMap = new Map<string, number>();
  for (const point of sorted) {
    const key = point.date.toISOString().substring(0, 10);
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
    const key = current.toISOString().substring(0, 10);
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

function aggregateEnergyByWeek(dataPoints: RawDataPoint[]): RawDataPoint[] {
  return aggregateByWeek(dataPoints, (point) => point.energy, "average").map((item) => ({
    date: item.date,
    energy: item.value,
  }));
}

function aggregateEnergyByMonth(dataPoints: RawDataPoint[]): RawDataPoint[] {
  return aggregateByMonth(dataPoints, (point) => point.energy, "average").map((item) => ({
    date: item.date,
    energy: item.value,
  }));
}

export type EnergyHistoryParams = {
  period: EnergyPeriod;
  offset?: number;
  locale?: string;
  headers?: Headers;
};

const cachedGetEnergyHistory = cache(
  async (
    period: EnergyPeriod,
    offset: number,
    locale: string,
    headers?: Headers,
  ): Promise<EnergyHistoryData | null> => {
    const session = await getSession({ headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const { current, previous } = calculateDateRanges(period, offset);

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

    const currentData = processEnergyData(rawData, period);

    const dataPoints: EnergyDataPoint[] = currentData.map((row) => ({
      date: row.date,
      energy: row.energy,
      label: formatLabel(row.date, period, locale),
    }));

    const average = calculateAverage(currentData);

    const previousRaw = previousResult.data ?? [];
    const previousData = previousRaw.length > 0 ? processEnergyData(previousRaw, period) : [];
    const previousAverage = previousData.length > 0 ? calculateAverage(previousData) : null;

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

export function getEnergyHistory(params: EnergyHistoryParams): Promise<EnergyHistoryData | null> {
  return cachedGetEnergyHistory(
    params.period,
    params.offset ?? 0,
    params.locale ?? "en",
    params.headers,
  );
}

async function fetchDailyData(
  userId: number,
  start: Date,
  end: Date,
): Promise<{ data: RawDataPoint[] | null; error: unknown }> {
  const result = await safeAsync(() =>
    prisma.dailyProgress.findMany({
      orderBy: { date: "asc" },
      select: { date: true, energyAtEnd: true },
      where: { date: { gte: start, lte: end }, userId },
    }),
  );

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  return {
    data: result.data.map((row) => ({
      date: row.date,
      energy: row.energyAtEnd,
    })),
    error: null,
  };
}

function processEnergyData(rawData: RawDataPoint[], period: EnergyPeriod): RawDataPoint[] {
  const withDecay = fillGapsWithDecay(rawData);

  if (period === "6months") {
    return aggregateEnergyByWeek(withDecay);
  }

  if (period === "year") {
    return aggregateEnergyByMonth(withDecay);
  }

  return withDecay;
}
