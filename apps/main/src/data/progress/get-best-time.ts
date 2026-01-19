import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { getPeakTime as getPeakTimeQuery } from "@zoonk/db/peak-time";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type BestTimeData = {
  score: number;
  period: number;
};

export type BestTimeParams = {
  headers?: Headers;
  startDate?: Date;
  endDate?: Date;
};

const cachedGetBestTime = cache(
  async (
    startDateIso: string | undefined,
    headers?: Headers,
  ): Promise<BestTimeData | null> => {
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

      const score = (correct / total) * 100;

      const isBetter =
        !bestTime ||
        score > bestTime.score ||
        (score === bestTime.score && total > bestTimeTotal);

      if (isBetter) {
        bestTime = { period: Number(row.period), score };
        bestTimeTotal = total;
      }
    }

    return bestTime;
  },
);

export function getBestTime(
  params?: BestTimeParams,
): Promise<BestTimeData | null> {
  return cachedGetBestTime(params?.startDate?.toISOString(), params?.headers);
}
