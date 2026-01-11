import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { getBestDay as getBestDayQuery } from "@zoonk/db/best-day";
import { safeAsync } from "@zoonk/utils/error";
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

    const { data: results, error } = await safeAsync(() =>
      prisma.$queryRawTyped(getBestDayQuery(userId, startDate)),
    );

    if (error || !results || results.length === 0) {
      return null;
    }

    let bestDay: BestDayData | null = null;
    let bestDayTotal = 0;

    for (const row of results) {
      const correct = Number(row.correct);
      const incorrect = Number(row.incorrect);
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
        bestDay = { score, dayOfWeek: Number(row.dayOfWeek) };
        bestDayTotal = total;
      }
    }

    return bestDay;
  },
);
