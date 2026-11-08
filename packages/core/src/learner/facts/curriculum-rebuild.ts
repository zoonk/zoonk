import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";

/** Read-only fact after goal ownership was checked; the row stays until its rebuild finishes. */
export async function readCurriculumRebuild(userId: string, goalId: string): Promise<boolean> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const owed = await prisma.followUp.findUnique({
    select: { id: true },
    where: { userKindKey: { key: goalId, kind: "rebuildGoalCurriculum", userId } },
  });

  return owed !== null;
}
