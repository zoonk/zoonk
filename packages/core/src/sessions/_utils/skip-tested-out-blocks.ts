import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { oweStartedDaySettlements } from "./owe-started-day-settlements";

export async function loadItemLessonIds(
  planItemIds: readonly string[],
  tx: TransactionClient = prisma,
): Promise<string[]> {
  const items = await tx.planItem.findMany({
    select: { chapterId: true, lessonId: true },
    where: { id: { in: [...planItemIds] } },
  });

  const chapterIds = items.flatMap((item) => (item.lessonId ? [] : (item.chapterId ?? [])));

  const chapterLessons =
    chapterIds.length > 0
      ? await tx.chapterLesson.findMany({
          select: { lessonId: true },
          where: { chapterId: { in: chapterIds } },
        })
      : [];

  return [
    ...new Set([
      ...items.flatMap((item) => item.lessonId ?? []),
      ...chapterLessons.map((row) => row.lessonId),
    ]),
  ];
}

/** Caller holds the learner lock. Other goals retain active work, reinforcement and deliberate replays. */
export async function skipSettledLessonBlocks(
  tx: TransactionClient,
  {
    goalId = null,
    lessonIds,
    notStarted = false,
    skipActive = false,
    userId,
  }: {
    goalId?: string | null;
    lessonIds: readonly string[];
    notStarted?: boolean;
    skipActive?: boolean;
    userId: string;
  },
): Promise<number> {
  if (lessonIds.length === 0) {
    return 0;
  }

  // Match queue writers' block-lock order rather than relying on UPDATE scan order.
  const blocks = await tx.$queryRaw<{ id: string; sessionId: string }[]>`
    SELECT block.id, block.session_id AS "sessionId" FROM study_session_blocks AS block
    JOIN study_sessions AS session ON session.id = block.session_id
    WHERE block.kind = 'learn' AND block.lesson_id = ANY(${[...lessonIds]}::uuid[])
      AND session.user_id = ${userId}::uuid AND session.status IN ('planned', 'active')
      AND (
        (session.goal_id = ${goalId}::uuid
          AND ((${skipActive} AND block.status = 'active') OR (${notStarted} AND block.status = 'pending')))
        OR ((${goalId}::uuid IS NULL OR session.goal_id IS DISTINCT FROM ${goalId}::uuid)
          AND block.status = 'pending' AND block.started_at IS NULL
          AND COALESCE(block.payload ->> 'extra', 'false') = 'false'
          AND COALESCE(block.payload ->> 'reinforcement', 'false') = 'false'
          AND NOT EXISTS (
            SELECT 1 FROM plan_items AS item
            JOIN plans AS plan ON plan.id = item.plan_id
            WHERE plan.goal_id = session.goal_id AND item.lesson_id = block.lesson_id
              AND item.status = 'todo'
          ))
      )
    ORDER BY block.id FOR UPDATE OF block
  `;

  if (blocks.length === 0) {
    return 0;
  }

  const updated = await tx.studySessionBlock.updateMany({
    data: { status: "skipped" },
    where: { id: { in: blocks.map((block) => block.id) } },
  });

  await oweStartedDaySettlements(tx, blocks);
  return updated.count;
}

/** Skips tested-out lessons in open sessions; notStarted also removes pending blocks without rebuilding the rest. */
export async function skipTestedOutBlocks({
  goalId,
  notStarted = false,
  planItemIds,
}: {
  goalId: string;
  /** Skips the settled lessons' blocks not started yet too: the rest of the day stays as it is. */
  notStarted?: boolean;
  planItemIds: readonly string[];
}): Promise<void> {
  const [goal, lessonIds] = await Promise.all([
    prisma.goal.findUnique({ where: { id: goalId } }),
    loadItemLessonIds(planItemIds),
  ]);

  if (!goal || lessonIds.length === 0) {
    return;
  }

  await writeLearnerChange({ userId: goal.userId }, async (tx) => {
    const skipped = await skipSettledLessonBlocks(tx, {
      goalId,
      lessonIds,
      notStarted,
      skipActive: true,
      userId: goal.userId,
    });

    return skipped === 0 ? unchanged(null) : null;
  });
}
