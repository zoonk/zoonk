import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";

/** After goal ownership was checked: a live rebuild holds the reveal; its plan records terminal failure. */
export async function readCurriculumRebuild(userId: string, goalId: string): Promise<boolean> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const owed = await prisma.followUp.findUnique({
    select: { failedAt: true },
    where: { userKindKey: { key: goalId, kind: "rebuildGoalCurriculum", userId } },
  });

  return owed !== null && owed.failedAt === null;
}
