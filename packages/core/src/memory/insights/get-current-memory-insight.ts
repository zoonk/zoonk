import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { cacheTag } from "next/cache";
import { getLearningProfileCacheTag, getMemoryCacheTag } from "../../cache/tags";
import { readLearningProfile } from "../../learner/facts/learning-profile";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { getSession } from "../../users/get-session";
import { type MemoryInsightQuery, type MemoryInsightView } from "../memory-contract";
import { toMemoryInsightView } from "./_utils/insight-view";

const SHOWN_FOR_DAYS = 2;

export type CurrentMemoryInsightResult =
  | { insight: MemoryInsightView | null; status: "ready" }
  | { status: "unauthorized" };

export async function getCurrentMemoryInsight(
  input: MemoryInsightQuery,
): Promise<CurrentMemoryInsightResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  cacheTag(getMemoryCacheTag(userId), getLearningProfileCacheTag(userId));

  const [profile, now] = await Promise.all([readLearningProfile(userId), getRequestInstant()]);

  if (profile?.memoryEnabled === false) {
    return { insight: null, status: "ready" };
  }

  const insight = await prisma.memoryInsight.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: {
      createdAt: { gte: new Date(now.getTime() - SHOWN_FOR_DAYS * MS_PER_DAY) },
      kind: { not: null },
      message: { not: null },
      userId,
      ...(input.goalId && { OR: [{ goalId: input.goalId }, { goalId: null }] }),
    },
  });

  return {
    insight: insight?.status === "pending" ? await toMemoryInsightView(insight) : null,
    status: "ready",
  };
}
