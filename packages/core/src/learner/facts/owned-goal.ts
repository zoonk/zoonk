import "server-only";
import { prisma } from "@zoonk/db";
import { cacheLife, cacheTag } from "next/cache";
import { getGoalsCacheTag } from "../../cache/tags";

/** Internal GET fact: the authenticated boundary supplies both primitive cache-key arguments. */
export async function readOwnedGoal(userId: string, goalId: string) {
  "use cache: private";

  cacheLife({ stale: Infinity });
  cacheTag(getGoalsCacheTag(userId));

  return prisma.goal.findFirst({ where: { id: goalId, userId } });
}
