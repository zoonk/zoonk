import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type BestDayData = {
  score: number;
  dayOfWeek: number;
};

export type BestDayParams = {
  headers?: Headers;
  /**
   * Start date for filtering. When provided,
   * uses this date instead of the default 90-day window.
   */
  startDate?: Date;
};

export const getBestDay = cache(
  async (params?: BestDayParams): Promise<BestDayData | null> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);

    // Use provided start date or default to 90 days ago
    let startDate: Date;

    if (params?.startDate) {
      startDate = params.startDate;
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
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
        !bestDay ||
        score > bestDay.score ||
        (score === bestDay.score && total > bestDayTotal);

      if (isBetter) {
        bestDay = { dayOfWeek: row.dayOfWeek, score };
        bestDayTotal = total;
      }
    }

    return bestDay;
  },
);
