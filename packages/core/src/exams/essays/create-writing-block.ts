import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { appendExtraBlocks, withSessionAppendLock } from "../../sessions/_utils/extra-blocks";
import { findStudySessionFor } from "../../sessions/_utils/study-session-access";
import { openStudyDay } from "../../sessions/open-study-day";
import { unfinishedExtraWritingWhere } from "./_utils/extra-writing-blocks";
import { loadSessionProduce } from "./_utils/load-produce";
import { toProduceBlock } from "./produce-block";

export async function createWritingBlock({
  goalId,
  taskKey,
}: {
  goalId: string;
  taskKey?: string;
}) {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal });
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const plan = await prisma.plan.findUnique({
    select: { graph: true, settings: true },
    where: { goalId },
  });

  const produce = await loadSessionProduce({
    goal,
    onDemand: true,
    planGraph: parsePlanGraph(plan?.graph),
    planSettings: plan?.settings,
    taskKey,
    today,
    userId,
  });

  if (!produce) {
    return { status: "notFound" as const };
  }

  const opened = await openStudyDay({ goalId, keepEmpty: true, shownDate: toIsoDate(today) });

  if (opened.status !== "opened") {
    return { status: "blockNotActive" as const };
  }

  const saved = await findStudySessionFor({ sessionId: opened.sessionId, userId });

  if (saved.status !== "ready") {
    return saved;
  }

  const result = await withSessionAppendLock({
    run: async ({ session, transaction }) => {
      if (session.userId !== userId) {
        return { status: "notFound" as const };
      }

      const unfinished = await transaction.studySessionBlock.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        where: {
          ...unfinishedExtraWritingWhere({ goalId, userId }),
          payload: { equals: produce.taskKey, path: ["writing", "taskKey"] },
        },
      });

      if (unfinished) {
        return { blockId: unfinished.id, status: "ready" as const };
      }

      const block = toProduceBlock(produce);

      const created = await appendExtraBlocks({
        planned: [{ ...block, payload: { ...block.payload, extra: true } }],
        session,
        transaction,
      });

      return { blockId: created.id, created: true, status: "ready" as const };
    },
    session: saved.session,
  });

  if (result.status !== "ready") {
    return result;
  }

  if (result.created) {
    revalidateCacheTags([getLearnerModelCacheTag(userId)]);
  }

  return { blockId: result.blockId, status: "ready" as const };
}
