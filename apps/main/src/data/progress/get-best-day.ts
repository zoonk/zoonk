import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { getBestDay as getBestDayQuery } from "@zoonk/db/best-day";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type BestDayData = {
  accuracy: number;
  dayOfWeek: number;
};

export const getBestDay = cache(
  async (params?: { headers?: Headers }): Promise<BestDayData | null> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: results, error } = await safeAsync(() =>
      prisma.$queryRawTyped(getBestDayQuery(userId, ninetyDaysAgo)),
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

      const accuracy = (correct / total) * 100;

      const isBetter =
        !bestDay ||
        accuracy > bestDay.accuracy ||
        (accuracy === bestDay.accuracy && total > bestDayTotal);

      if (isBetter) {
        bestDay = { accuracy, dayOfWeek: Number(row.dayOfWeek) };
        bestDayTotal = total;
      }
    }

    return bestDay;
  },
);
