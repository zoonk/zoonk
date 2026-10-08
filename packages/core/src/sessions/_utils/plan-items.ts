import { type TransactionClient } from "@zoonk/db";
import { after } from "next/server";
import { trackLessonCanDos } from "../../language/units/can-do-events";

/**
 * Checks a plan item off once what it asks for is done. Only the learner's own todo items move, so
 * an item tested out or done earlier keeps its status and date.
 */
export async function completePlanItem(
  tx: TransactionClient,
  { now, planItemId, userId }: { now: Date; planItemId: string; userId: string },
) {
  await tx.planItem.updateMany({
    data: { completedAt: now, status: "done" },
    where: { id: planItemId, plan: { goal: { userId } }, status: "todo" },
  });
}

/** A language goal whose plan just checked a lesson off: its unit may reach its "I can" checks. */
export type CheckedLanguageGoal = { id: string };

/**
 * A lesson finished checks off every one of the learner's plan items for it, in any goal: the
 * lesson is shared, so learning it once counts wherever it's planned. Returns the language goals
 * among them, for `scheduleLessonCanDos` once the transaction commits.
 */
export async function completeLessonPlanItems(
  tx: TransactionClient,
  { lessonId, now, userId }: { lessonId: string; now: Date; userId: string },
): Promise<CheckedLanguageGoal[]> {
  const checked = await tx.planItem.updateManyAndReturn({
    data: { completedAt: now, status: "done" },
    select: { planId: true },
    where: { lessonId, plan: { goal: { userId } }, status: "todo" },
  });

  if (checked.length === 0) {
    return [];
  }

  return tx.goal.findMany({
    select: { id: true },
    where: { kind: "language", plan: { id: { in: checked.map((item) => item.planId) } } },
  });
}

/**
 * Analytics hears the "I can" checks a finished lesson reached after the response. Call it once
 * the transaction that checked the lesson off has committed, so the check reads its plan items.
 */
export function scheduleLessonCanDos({
  goals,
  lessonId,
  userId,
}: {
  goals: readonly CheckedLanguageGoal[];
  lessonId: string;
  userId: string;
}): void {
  if (goals.length > 0) {
    after(() => trackLessonCanDos({ goals, lessonId, userId }));
  }
}
