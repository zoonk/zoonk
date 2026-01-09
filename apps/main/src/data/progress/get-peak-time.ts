import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { getPeakTime as getPeakTimeQuery } from "@zoonk/db/peak-time";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type PeakTimeData = {
  accuracy: number;
  period: number;
};

export const getPeakTime = cache(
  async (params?: { headers?: Headers }): Promise<PeakTimeData | null> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return null;
    }

    const userId = Number(session.user.id);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: results, error } = await safeAsync(() =>
      prisma.$queryRawTyped(getPeakTimeQuery(userId, ninetyDaysAgo)),
    );

    if (error || !results || results.length === 0) {
      return null;
    }

    let peakTime: PeakTimeData | null = null;
    let peakTimeTotal = 0;

    for (const row of results) {
      const correct = Number(row.correct);
      const incorrect = Number(row.incorrect);
      const total = correct + incorrect;

      if (total === 0) {
        continue;
      }

      const accuracy = (correct / total) * 100;

      const isBetter =
        !peakTime ||
        accuracy > peakTime.accuracy ||
        (accuracy === peakTime.accuracy && total > peakTimeTotal);

      if (isBetter) {
        peakTime = { accuracy, period: Number(row.period) };
        peakTimeTotal = total;
      }
    }

    return peakTime;
  },
);
