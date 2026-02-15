import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

type ScoreData = {
  score: number;
};

function getDateRange(
  startDateIso: string | undefined,
  endDateIso: string | undefined,
): { startDate: Date; endDate: Date } {
  if (startDateIso && endDateIso) {
    return { endDate: new Date(endDateIso), startDate: new Date(startDateIso) };
  }
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DEFAULT_PROGRESS_LOOKBACK_DAYS);
  return { endDate, startDate };
}

function calculateScoreFromTotals(correct: number, incorrect: number): number | null {
  const total = correct + incorrect;
  if (total === 0) {
    return null;
  }
  return (correct / total) * 100;
}

const cachedGetScore = cache(
  async (
    startDateIso: string | undefined,
    endDateIso: string | undefined,
    headers?: Headers,
  ): Promise<ScoreData | null> => {
    const session = await getSession(headers);
    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const { startDate, endDate } = getDateRange(startDateIso, endDateIso);

    const { data: result, error } = await safeAsync(() =>
      prisma.dailyProgress.aggregate({
        _sum: { correctAnswers: true, incorrectAnswers: true },
        where: { date: { gte: startDate, lte: endDate }, userId },
      }),
    );

    if (error || !result) {
      return null;
    }

    const score = calculateScoreFromTotals(
      result._sum.correctAnswers ?? 0,
      result._sum.incorrectAnswers ?? 0,
    );

    return score === null ? null : { score };
  },
);

export function getScore(params?: {
  headers?: Headers;
  startDate?: Date;
  endDate?: Date;
}): Promise<ScoreData | null> {
  return cachedGetScore(
    params?.startDate?.toISOString(),
    params?.endDate?.toISOString(),
    params?.headers,
  );
}
