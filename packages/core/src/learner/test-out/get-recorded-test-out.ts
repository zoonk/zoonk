import "server-only";
import { prisma } from "@zoonk/db";
import { canUndoChange } from "../../plans/_utils/plan-change-view";
import { findOwnedGoal } from "../_utils/owned-goal";
import { findTestOutReceipt } from "./_utils/test-out-receipt";

type RecordedTestOut = {
  /** Whether its plan change can still be undone: the plan is exactly as this skip left it. */
  canUndo: boolean;
  /** The plan change that skipped its lessons; null when it skipped none. */
  changeId: string | null;
  correct: number;
  lessonsSkipped: number;
  passed: boolean;
  total: number;
  undone: boolean;
};

export type RecordedTestOutResult =
  | { result: RecordedTestOut; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Read-only recorded result; undo is valid only while the plan matches this receipt's version. */
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

  const receipt = await findTestOutReceipt({ chapterId, goalId, requestId, userId: owned.userId });

  if (!receipt) {
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
      canUndo: Boolean(
        change &&
        plan?.version === receipt.planVersion &&
        canUndoChange({ change, planVersion: plan.version }),
      ),
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
