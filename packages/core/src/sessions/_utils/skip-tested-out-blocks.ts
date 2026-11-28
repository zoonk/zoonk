import "server-only";
import { type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { readBlockPayload } from "../block-payload";
import { isOutsidePlanLesson } from "../day-block";
import { oweStartedDaySettlements } from "./owe-started-day-settlements";

/** Caller holds the learner lock. */
export async function skipSettledLessonBlocks(
  tx: TransactionClient,
  { lessonIds, userId }: { lessonIds: readonly string[]; userId: string },
): Promise<void> {
  if (lessonIds.length === 0) {
    return;
  }

  // Match queue writers' block-lock order rather than relying on UPDATE scan order.
  const candidates = await tx.$queryRaw<Pick<StudySessionBlock, "id" | "payload" | "sessionId">[]>`
    SELECT block.id, block.payload, block.session_id AS "sessionId" FROM study_session_blocks AS block
    JOIN study_sessions AS session ON session.id = block.session_id
    WHERE block.kind = 'learn' AND block.lesson_id = ANY(${[...lessonIds]}::uuid[])
      AND session.user_id = ${userId}::uuid AND session.status IN ('planned', 'active')
      AND block.status = 'pending' AND block.started_at IS NULL
      AND COALESCE(block.payload ->> 'extra', 'false') = 'false'
      AND NOT EXISTS (
        SELECT 1 FROM plan_items AS item
        JOIN plans AS plan ON plan.id = item.plan_id
        WHERE plan.goal_id = session.goal_id AND item.lesson_id = block.lesson_id
          AND item.status = 'todo'
      )
    ORDER BY block.id FOR UPDATE OF block
  `;

  const blocks = candidates.filter((block) => !isOutsidePlanLesson(readBlockPayload(block)));

  if (blocks.length === 0) {
    return;
  }

  await tx.studySessionBlock.updateMany({
    data: { status: "skipped" },
    where: { id: { in: blocks.map((block) => block.id) } },
  });

  await oweStartedDaySettlements(tx, blocks);
}

export async function keepOpenSessionSelection(
  tx: TransactionClient,
  { goalId, planVersion }: { goalId: string; planVersion: number },
): Promise<void> {
  await tx.studySession.updateMany({
    data: { planVersion },
    where: { goalId, status: { in: ["active", "planned"] } },
  });
}
