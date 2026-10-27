import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { hasSameGoalInputs } from "./goal-input-snapshot";
import { type SelectedDayPlan } from "./selected-day-plan";

/** Called after the first plan mark: no stale selection may publish its items or notice. */
export async function isSelectedPlanCurrent({
  increment,
  selection,
  tx,
}: {
  increment: number;
  selection: SelectedDayPlan;
  tx: TransactionClient;
}): Promise<boolean> {
  const { context } = selection;

  const [goal, plan] = await Promise.all([
    tx.goal.findFirst({ where: { id: context.goal.id, userId: context.goal.userId } }),
    tx.plan.findUnique({
      select: { inputVersion: true, summary: true, version: true },
      where: { id: context.plan.id },
    }),
  ]);

  return (
    goal !== null &&
    goal.status === "active" &&
    hasSameGoalInputs({ current: goal, planned: context.goal }) &&
    plan !== null &&
    plan.version === context.plan.version &&
    plan.inputVersion === context.plan.inputVersion + increment &&
    isDeepStrictEqual(plan.summary, context.plan.summary)
  );
}
