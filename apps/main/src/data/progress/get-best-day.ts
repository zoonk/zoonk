import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/constants";
import { cache } from "react";

export type BestDayData = {
  score: number;
  dayOfWeek: number;
};

export type BestDayParams = {
  headers?: Headers;
  startDate?: Date;
};

const cachedGetBestDay = cache(
  async (startDateIso: string | undefined, headers?: Headers): Promise<BestDayData | null> => {
    const session = await getSession({ headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);

    let startDate: Date;

    if (startDateIso) {
      startDate = new Date(startDateIso);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - DEFAULT_PROGRESS_LOOKBACK_DAYS);
    }

    const results = await prisma.dailyProgress.groupBy({
      _sum: {
        correctAnswers: true,
        incorrectAnswers: true,
      },
      by: ["dayOfWeek"],
      where: {
        date: { gte: startDate },
        userId,
      },
    });

    if (results.length === 0) {
      return null;
    }

    let bestDay: BestDayData | null = null;
    let bestDayTotal = 0;

    for (const row of results) {
      const correct = row._sum.correctAnswers ?? 0;
      const incorrect = row._sum.incorrectAnswers ?? 0;
      const total = correct + incorrect;

      if (total === 0) {
        continue;
      }

      const score = (correct / total) * 100;

      const isBetter =
        !bestDay || score > bestDay.score || (score === bestDay.score && total > bestDayTotal);

      if (isBetter) {
        bestDay = { dayOfWeek: row.dayOfWeek, score };
        bestDayTotal = total;
      }
    }

    return bestDay;
  },
);

export function getBestDay(params?: BestDayParams): Promise<BestDayData | null> {
  return cachedGetBestDay(params?.startDate?.toISOString(), params?.headers);
}
