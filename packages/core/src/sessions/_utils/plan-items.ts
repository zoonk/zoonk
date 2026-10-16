import { type TransactionClient } from "@zoonk/db";
import { after } from "next/server";
import { trackLessonCanDos } from "../../language/units/can-do-events";
import { readPlanSummary, reduceCompletedSummary } from "../../plans/_utils/plan-summary";

/**
 * Reduces each plan's posted summary by the lessons it just checked off. Only a lesson can change
 * one (see `reduceCompletedSummary`), so checking off anything else reads nothing. The read locks
 * the plans: writers that marked plan inputs already hold those locks, and a caller that didn't
 * (the seed finishing a day's lessons at once) then reduces after the other completion instead of
 * overwriting its credit.
 */
async function reduceCompletedPlans(
  tx: TransactionClient,
  {
    checked,
    userId,
  }: { checked: readonly { lessonId: string | null; planId: string }[]; userId: string },
): Promise<void> {
  const lessons = checked.filter((item) => item.lessonId !== null);

  if (lessons.length === 0) {
    return;
  }

  const byPlan = Map.groupBy(lessons, (item) => item.planId);

  const plans = await tx.$queryRaw<{ id: string; summary: unknown; version: number }[]>`
    SELECT plan.id, plan.summary, plan.version FROM plans AS plan
    JOIN goals AS goal ON goal.id = plan.goal_id
    WHERE plan.id = ANY(${[...byPlan.keys()]}::uuid[]) AND goal.user_id = ${userId}::uuid
    ORDER BY plan.id FOR UPDATE OF plan
  `;

  await Promise.all(
    plans.map(async (plan) => {
      const reduction = reduceCompletedSummary({
        completed: byPlan.get(plan.id) ?? [],
        summary: readPlanSummary({ plan: { ...plan, userId }, value: plan.summary }),
      });

      if (reduction.kind === "reduced") {
        await tx.plan.update({
          data: { coveredShare: reduction.coveredShare, summary: reduction.summary },
          where: { id: plan.id },
        });
      }
    }),
  );
}

/**
 * Checks a plan item off once what it asks for is done. Only the learner's own todo items move, so
 * an item tested out or done earlier keeps its status and date.
 */
export async function completePlanItem(
  tx: TransactionClient,
  { now, planItemId, userId }: { now: Date; planItemId: string; userId: string },
) {
  const checked = await tx.planItem.updateManyAndReturn({
    data: { completedAt: now, status: "done" },
    select: { lessonId: true, planId: true },
    where: { id: planItemId, plan: { goal: { userId } }, status: "todo" },
  });

  await reduceCompletedPlans(tx, { checked, userId });
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
    select: { lessonId: true, planId: true },
    where: { lessonId, plan: { goal: { userId } }, status: "todo" },
  });

  if (checked.length === 0) {
    return [];
  }

  await reduceCompletedPlans(tx, { checked, userId });

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
