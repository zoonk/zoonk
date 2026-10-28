import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { fromIsoDate } from "../../plans/planner/plan-calendar";

/** GET-only fact keyed by learner-local YYYY-MM-DD; writes must read fresh. */
export async function readDayProgress(userId: string, isoDate: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId), getLearnerModelCacheTag(userId));

  return prisma.dailyProgress.findUnique({
    where: { userDate: { date: fromIsoDate(isoDate), userId } },
  });
}
