import "server-only";
import { prisma } from "@zoonk/db";
import { canUndoChange } from "../../plans/_utils/plan-change-view";
import { findOwnedGoal } from "../_utils/owned-goal";
import { findTestOutReceipt } from "./_utils/test-out-receipt";

/** A chapter test-out the learner sent, as it was recorded then. */
type RecordedTestOut = {
  /** Whether its plan change can still be undone: the plan is exactly as the skip left it. */
  canUndo: boolean;
  /** The plan change that skipped its lessons; null when it skipped none. */
  changeId: string | null;
  correct: number;
  /** The lessons its result said were off the plan. */
  lessonsSkipped: number;
  passed: boolean;
  total: number;
  /** Whether the learner undid the skip: its lessons are back in the plan. */
  undone: boolean;
};

export type RecordedTestOutResult =
  | { result: RecordedTestOut; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * The result of a chapter test-out the learner sent (its `requestId`), as it was recorded, so a
 * reload, Back or the link opened later shows that result again instead of a new test. Its undo
 * holds while the plan is as the skip left it, as on the Plan. Nothing is written.
 */
export async function getRecordedTestOut({
  chapterId,
  goalId,
  requestId,
}: {
  chapterId: string;
  goalId: string;
  requestId: string;
}): Promise<RecordedTestOutResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const receipt = await findTestOutReceipt({ requestId, userId: owned.userId });

  if (!receipt || receipt.chapterId !== chapterId || receipt.goalId !== goalId) {
    return { status: "notFound" };
  }

  const [change, plan] = await Promise.all([
    receipt.changeId
      ? prisma.planChange.findFirst({ where: { id: receipt.changeId, plan: { goalId } } })
      : null,
    prisma.plan.findUnique({ select: { version: true }, where: { goalId } }),
  ]);

  return {
    result: {
      canUndo: Boolean(change && plan && canUndoChange({ change, planVersion: plan.version })),
      changeId: receipt.changeId,
      correct: receipt.correct,
      lessonsSkipped: receipt.lessonsSkipped,
      passed: receipt.passed,
      total: receipt.total,
      undone: change?.status === "undone",
    },
    status: "ready",
  };
}
