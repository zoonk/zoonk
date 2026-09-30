import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { cacheTag } from "next/cache";
import { getMemoryCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { getMemoryAccess } from "../_utils/memory-access";
import { type MemoryInsightQuery, type MemoryInsightView } from "../memory-contract";
import { toMemoryInsightView } from "./_utils/insight-view";

/** An insight comes from the last session, so it's shown until the learner answers or it's two days old. */
const SHOWN_FOR_DAYS = 2;

export type CurrentMemoryInsightResult =
  | { insight: MemoryInsightView | null; status: "ready" }
  | { status: "unauthorized" };

/**
 * The insight Today shows ("From your recent answers"): the newest one, for this goal or for no
 * goal in particular, until the learner answers it. An older insight never comes back once a newer
 * one was answered, and nothing shows while memory is off.
 */
export async function getCurrentMemoryInsight(
  input: MemoryInsightQuery,
): Promise<CurrentMemoryInsightResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  cacheTag(getMemoryCacheTag(userId));

  const access = await getMemoryAccess(userId);

  if (!access.enabled) {
    return { insight: null, status: "ready" };
  }

  const insight = await prisma.memoryInsight.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: {
      createdAt: { gte: new Date(Date.now() - SHOWN_FOR_DAYS * MS_PER_DAY) },
      kind: { not: null },
      message: { not: null },
      userId,
      ...(input.goalId && { OR: [{ goalId: input.goalId }, { goalId: null }] }),
    },
  });

  return {
    insight: insight?.status === "pending" ? toMemoryInsightView(insight) : null,
    status: "ready",
  };
}
