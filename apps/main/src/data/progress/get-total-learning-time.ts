import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";

type TotalLearningTimeData = { totalLearningSeconds: number };

const cachedGetTotalLearningTime = cache(
  async (headers?: Headers): Promise<TotalLearningTimeData | null> => {
    const session = await getSession(headers);

    if (!session) {
      return null;
    }

    const result = await prisma.dailyProgress.aggregate({
      _sum: { timeSpentSeconds: true },
      where: { userId: session.user.id },
    });

    return { totalLearningSeconds: result._sum.timeSpentSeconds ?? 0 };
  },
);

/**
 * The homepage needs the learner's lifetime lesson time. DailyProgress is the
 * same durable aggregate used by admin stats, and completion writes cap each
 * increment before updating this row.
 */
export function getTotalLearningTime(params?: {
  headers?: Headers;
}): Promise<TotalLearningTimeData | null> {
  return cachedGetTotalLearningTime(params?.headers);
}
