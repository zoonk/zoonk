import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import type { BeltLevelResult } from "@zoonk/utils/belt-level";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import {
  aggregateByMonth,
  aggregateByWeek,
  calculateDateRanges,
  formatLabel,
  type HistoryPeriod,
} from "./_utils";

export type BpDataPoint = {
  date: Date;
  bp: number;
  label: string;
};

export type BpHistoryData = {
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

export type BpHistoryParams = {
  period: HistoryPeriod;
  offset?: number;
  locale?: string;
  headers?: Headers;
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
      select: { brainPowerEarned: true, date: true },
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

function processBpData(
  rawData: RawDataPoint[],
  period: HistoryPeriod,
): RawDataPoint[] {
  if (period === "6months") {
    return aggregateByWeek(rawData, (p) => p.bp, "sum").map((v) => ({
      bp: v.value,
      date: v.date,
    }));
  }

  if (period === "year") {
    return aggregateByMonth(rawData, (p) => p.bp, "sum").map((v) => ({
      bp: v.value,
      date: v.date,
    }));
  }

  return rawData;
}

function sumBp(dataPoints: RawDataPoint[]): number {
  return dataPoints.reduce((acc, point) => acc + point.bp, 0);
}

const cachedGetBpHistory = cache(
  async (
    period: HistoryPeriod,
    offset: number,
    locale: string,
    headers?: Headers,
  ): Promise<BpHistoryData | null> => {
    const session = await getSession({ headers });

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
          select: { totalBrainPower: true },
          where: { userId },
        }),
      ),
    ]);

    if (currentResult.error || !currentResult.data) {
      return null;
    }

    const rawData = currentResult.data;

    if (rawData.length === 0) {
      return null;
    }

    const processedData = processBpData(rawData, period);

    const dataPoints: BpDataPoint[] = processedData.map((row) => ({
      bp: row.bp,
      date: row.date,
      label: formatLabel(row.date, period, locale),
    }));

    const periodTotal = sumBp(rawData);

    const previousRaw = previousResult.data ?? [];
    const previousPeriodTotal =
      previousRaw.length > 0 ? sumBp(previousRaw) : null;

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

    const totalBp = Number(progressResult.data?.totalBrainPower ?? 0);
    const currentBelt = calculateBeltLevel(totalBp);

    return {
      currentBelt,
      dataPoints,
      hasNextPeriod,
      hasPreviousPeriod,
      periodEnd: current.end,
      periodStart: current.start,
      periodTotal,
      previousPeriodTotal,
      totalBp,
    };
  },
);

export function getBpHistory(
  params: BpHistoryParams,
): Promise<BpHistoryData | null> {
  return cachedGetBpHistory(
    params.period,
    params.offset ?? 0,
    params.locale ?? "en",
    params.headers,
  );
}
