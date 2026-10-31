import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";

function loadSavedPlan(goalId: string) {
  return prisma.plan.findUnique({
    include: { items: { orderBy: { position: "asc" } } },
    where: { goalId },
  });
}

export type SavedPlan = NonNullable<Awaited<ReturnType<typeof loadSavedPlan>>>;

/** GET-only fact after ownership authorization; writes must read fresh. Items are in plan order. */
export async function readSavedPlan(userId: string, goalId: string): Promise<SavedPlan | null> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  return loadSavedPlan(goalId);
}
