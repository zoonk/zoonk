import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { type TimePeriod, aggregateByPeriod } from "@zoonk/utils/aggregation";
import { formatLabel } from "@zoonk/utils/chart";
import { type HistoryPeriod, calculateDateRanges } from "@zoonk/utils/date-ranges";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { fillGapsWithDecay } from "./_fill-gaps";

export type EnergyPeriod = HistoryPeriod;

export type EnergyDataPoint = {
  date: Date;
  energy: number;
  label: string;
};

type EnergyHistoryData = {
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

type RawDataPoint = { date: Date; energy: number };

function aggregateEnergy(dataPoints: RawDataPoint[], period: TimePeriod): RawDataPoint[] {
  return aggregateByPeriod(dataPoints, (point) => point.energy, "average", period).map((item) => ({
    date: item.date,
    energy: item.value,
  }));
}

function getPreviousAverage(
  previousData: RawDataPoint[] | null,
  period: EnergyPeriod,
): number | null {
  if (!previousData || previousData.length === 0) {
    return null;
  }
  const processed = processEnergyData(previousData, period);
  return processed.length > 0 ? calculateAverage(processed) : null;
}

async function hasEarlierData(userId: string, beforeDate: Date): Promise<boolean> {
  const { data } = await safeAsync(() =>
    prisma.dailyProgress.findFirst({
      where: { date: { lt: beforeDate }, userId },
    }),
  );
  return Boolean(data);
}

const cachedGetEnergyHistory = cache(
  async (
    period: EnergyPeriod,
    offset: number,
    locale: string,
    headers?: Headers,
  ): Promise<EnergyHistoryData | null> => {
    const session = await getSession(headers);
    if (!session) {
      return null;
    }

    const userId = session.user.id;
    const { current, previous } = calculateDateRanges(period, offset);

    const [currentResult, previousResult] = await Promise.all([
      fetchDailyData(userId, current.start, current.end),
      fetchDailyData(userId, previous.start, previous.end),
    ]);

    if (currentResult.error || !currentResult.data || currentResult.data.length === 0) {
      return null;
    }

    const currentData = processEnergyData(currentResult.data, period);
    const dataPoints: EnergyDataPoint[] = currentData.map((row) => ({
      date: row.date,
      energy: row.energy,
      label: formatLabel(row.date, period, locale),
    }));

    return {
      average: calculateAverage(currentData),
      dataPoints,
      hasNextPeriod: offset > 0,
      hasPreviousPeriod: await hasEarlierData(userId, current.start),
      periodEnd: current.end,
      periodStart: current.start,
      previousAverage: getPreviousAverage(previousResult.data, period),
    };
  },
);

export function getEnergyHistory(params: {
  period: EnergyPeriod;
  offset?: number;
  locale?: string;
  headers?: Headers;
}): Promise<EnergyHistoryData | null> {
  return cachedGetEnergyHistory(
    params.period,
    params.offset ?? 0,
    params.locale ?? "en",
    params.headers,
  );
}

async function fetchDailyData(
  userId: string,
  start: Date,
  end: Date,
): Promise<{ data: RawDataPoint[] | null; error: unknown }> {
  const result = await safeAsync(() =>
    prisma.dailyProgress.findMany({
      orderBy: { date: "asc" },
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

  if (period === "all") {
    return aggregateEnergy(withDecay, "year");
  }

  if (period === "6months") {
    return aggregateEnergy(withDecay, "week");
  }

  if (period === "year") {
    return aggregateEnergy(withDecay, "month");
  }

  return withDecay;
}
