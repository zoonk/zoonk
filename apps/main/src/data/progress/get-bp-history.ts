import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import {
  type HistoryPeriod,
  aggregateByMonth,
  aggregateByWeek,
  calculateDateRanges,
  formatLabel,
} from "./_utils";

export type BpDataPoint = {
  date: Date;
  bp: number;
  label: string;
};

type BpHistoryData = {
  dataPoints: BpDataPoint[];
  totalBp: number;
  periodTotal: number;
  previousPeriodTotal: number | null;
  periodStart: Date;
  periodEnd: Date;
  hasPreviousPeriod: boolean;
  hasNextPeriod: boolean;
  currentBelt: BeltLevelResult;
};

type RawDataPoint = { date: Date; bp: number };

async function fetchDailyBpData(
  userId: number,
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
      bp: row.brainPowerEarned,
      date: row.date,
    })),
    error: null,
  };
}

function processBpData(rawData: RawDataPoint[], period: HistoryPeriod): RawDataPoint[] {
  if (period === "6months") {
    return aggregateByWeek(rawData, (point) => point.bp, "sum").map((item) => ({
      bp: item.value,
      date: item.date,
    }));
  }

  if (period === "year") {
    return aggregateByMonth(rawData, (point) => point.bp, "sum").map((item) => ({
      bp: item.value,
      date: item.date,
    }));
  }

  return rawData;
}

function sumBp(dataPoints: RawDataPoint[]): number {
  return dataPoints.reduce((acc, point) => acc + point.bp, 0);
}

function getPreviousPeriodTotal(previousData: RawDataPoint[] | null): number | null {
  if (!previousData || previousData.length === 0) {
    return null;
  }
  return sumBp(previousData);
}

async function hasEarlierData(userId: number, beforeDate: Date): Promise<boolean> {
  const { data } = await safeAsync(() =>
    prisma.dailyProgress.findFirst({
      where: { date: { lt: beforeDate }, userId },
    }),
  );
  return Boolean(data);
}

const cachedGetBpHistory = cache(
  async (
    period: HistoryPeriod,
    offset: number,
    locale: string,
    headers?: Headers,
  ): Promise<BpHistoryData | null> => {
    const session = await getSession(headers);
    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const { current, previous } = calculateDateRanges(period, offset);

    const [currentResult, previousResult, progressResult] = await Promise.all([
      fetchDailyBpData(userId, current.start, current.end),
      fetchDailyBpData(userId, previous.start, previous.end),
      safeAsync(() =>
        prisma.userProgress.findUnique({
          where: { userId },
        }),
      ),
    ]);

    if (currentResult.error || !currentResult.data || currentResult.data.length === 0) {
      return null;
    }

    const processedData = processBpData(currentResult.data, period);
    const dataPoints: BpDataPoint[] = processedData.map((row) => ({
      bp: row.bp,
      date: row.date,
      label: formatLabel(row.date, period, locale),
    }));

    const totalBp = Number(progressResult.data?.totalBrainPower ?? 0);

    return {
      currentBelt: calculateBeltLevel(totalBp),
      dataPoints,
      hasNextPeriod: offset > 0,
      hasPreviousPeriod: await hasEarlierData(userId, current.start),
      periodEnd: current.end,
      periodStart: current.start,
      periodTotal: sumBp(currentResult.data),
      previousPeriodTotal: getPreviousPeriodTotal(previousResult.data),
      totalBp,
    };
  },
);

export function getBpHistory(params: {
  period: HistoryPeriod;
  offset?: number;
  locale?: string;
  headers?: Headers;
}): Promise<BpHistoryData | null> {
  return cachedGetBpHistory(
    params.period,
    params.offset ?? 0,
    params.locale ?? "en",
    params.headers,
  );
}
