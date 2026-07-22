import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

type TotalLearningTimeData = { totalLearningSeconds: number };

async function findTotalLearningTime(userId: string): Promise<TotalLearningTimeData> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const result = await prisma.dailyProgress.aggregate({
    _sum: { timeSpentSeconds: true },
    where: { userId },
  });

  return { totalLearningSeconds: result._sum.timeSpentSeconds ?? 0 };
}

/** Returns the authenticated learner's lifetime learning duration. */
export async function getTotalLearningTime(): Promise<TotalLearningTimeData | null> {
  const session = await getSession();
  return session ? findTotalLearningTime(session.user.id) : null;
}
