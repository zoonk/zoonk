import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { getPeakTime as getPeakTimeQuery } from "@zoonk/db/peak-time";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type BestTimeData = {
  accuracy: number;
  period: number;
};

export type BestTimeParams = {
  headers?: Headers;
  /**
   * Start date for filtering. When provided with endDate,
   * uses the date range instead of the default 90-day window.
   */
  startDate?: Date;
  /**
   * End date for filtering. When provided with startDate,
   * uses the date range instead of the default 90-day window.
   */
  endDate?: Date;
};

export const getBestTime = cache(
  async (params?: BestTimeParams): Promise<BestTimeData | null> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);

    // Use provided date range or default to 90 days
    let startDate: Date;

    if (params?.startDate) {
      startDate = params.startDate;
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
    }

    const { data: results, error } = await safeAsync(() =>
      prisma.$queryRawTyped(getPeakTimeQuery(userId, startDate)),
    );

    if (error || !results || results.length === 0) {
      return null;
    }

    let bestTime: BestTimeData | null = null;
    let bestTimeTotal = 0;

    for (const row of results) {
      const correct = Number(row.correct);
      const incorrect = Number(row.incorrect);
      const total = correct + incorrect;

      if (total === 0) {
        continue;
      }

      const accuracy = (correct / total) * 100;

      const isBetter =
        !bestTime ||
        accuracy > bestTime.accuracy ||
        (accuracy === bestTime.accuracy && total > bestTimeTotal);

      if (isBetter) {
        bestTime = { accuracy, period: Number(row.period) };
        bestTimeTotal = total;
      }
    }

    return bestTime;
  },
);
