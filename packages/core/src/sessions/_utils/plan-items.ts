import { type TransactionClient } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { after } from "next/server";
import { trackLessonCanDos } from "../../language/units/can-do-events";
import { readPlanSummary, reduceCompletedSummary } from "../../plans/_utils/plan-summary";

/** Lock each plan before reducing its summary, including callers that did not mark plan inputs first. */
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

/** Only owned todo items change; tested-out and completed items keep their status and date. */
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

/** A lost phase challenge retries on the local day after localDate, not later the same day. */
export async function moveLostCheckpoint(
  tx: TransactionClient,
  { localDate, planItemId, userId }: { localDate: Date; planItemId: string; userId: string },
) {
  await tx.planItem.updateMany({
    data: { scheduledFor: new Date(localDate.getTime() + MS_PER_DAY) },
    where: { id: planItemId, plan: { goal: { userId } }, status: "todo" },
  });
}

export type CheckedLanguageGoal = { id: string };

/** Completes all owned plan occurrences of the lesson; scheduleLessonCanDos must run after commit for returned language goals. */
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

/** Call after the completion transaction commits so the checks see its plan items. */
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
