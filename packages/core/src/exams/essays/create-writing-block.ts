import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { appendExtraBlocks, withSessionAppendLock } from "../../sessions/_utils/extra-blocks";
import { findStudySessionFor } from "../../sessions/_utils/study-session-access";
import { readBlockPayload } from "../../sessions/block-payload";
import { openStudyDay } from "../../sessions/open-study-day";
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

  const produce = await loadSessionProduce({
    goal,
    onDemand: true,
    planSettings: null,
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

  return withSessionAppendLock({
    run: async ({ session, transaction }) => {
      if (session.userId !== userId) {
        return { status: "notFound" as const };
      }

      const unfinished = await transaction.studySessionBlock.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          AND: [
            { payload: { equals: true, path: ["extra"] } },
            { payload: { equals: produce.taskKey, path: ["writing", "taskKey"] } },
          ],
          kind: "produce",
          session: { goalId, userId },
          status: { in: ["active", "pending"] },
        },
      });

      if (unfinished && readBlockPayload(unfinished).writing?.unit === "answer") {
        return { blockId: unfinished.id, status: "ready" as const };
      }

      const block = toProduceBlock(produce);

      const created = await appendExtraBlocks({
        planned: [{ ...block, payload: { ...block.payload, extra: true } }],
        session,
        transaction,
      });

      return { blockId: created.id, status: "ready" as const };
    },
    session: saved.session,
  });
}
