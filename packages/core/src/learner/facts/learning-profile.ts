import "server-only";
import { prisma } from "@zoonk/db";
import { cacheLife, cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../../cache/tags";
import { readOwnedGoal } from "./owned-goal";

/** Internal GET fact; the public capability derives the actor, including for a guest. */
export async function readLearningProfile(userId: string) {
  "use cache: private";

  cacheLife({ stale: Infinity });
  cacheTag(getLearningProfileCacheTag(userId));

  return prisma.userLearningProfile.findUnique({ where: { userId } });
}

/** A stored selection is authoritative even when ineligible for a particular caller's view. */
export async function readActiveGoal(userId: string) {
  "use cache: private";

  cacheLife({ stale: Infinity });
  cacheTag(getGoalsCacheTag(userId), getLearningProfileCacheTag(userId));

  const profile = await readLearningProfile(userId);

  if (profile?.activeGoalId) {
    return readOwnedGoal(userId, profile.activeGoalId);
  }

  return prisma.goal.findFirst({
    orderBy: { createdAt: "asc" },
    where: { status: "active", userId },
  });
}
