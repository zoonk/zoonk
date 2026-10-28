import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { fromIsoDate } from "../../plans/planner/plan-calendar";

/**
 * Internal GET fact: the learner's totals for one local day (`YYYY-MM-DD`), read once per request
 * for Today's "studied today", the buddy's nap and the day's time limit. Writes read it fresh.
 */
export async function readDayProgress(userId: string, isoDate: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId), getLearnerModelCacheTag(userId));

  return prisma.dailyProgress.findUnique({
    where: { userDate: { date: fromIsoDate(isoDate), userId } },
  });
}
