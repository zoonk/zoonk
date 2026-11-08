import { startOnce } from "../_shared/run-token";
import { type GoalRunContext } from "./goal-run-context";
import { placementItemsWorkflow } from "./placement-items-workflow";
import { goalProgressStep } from "./steps/goal-progress-step";

export async function preparePlanPlacement({
  context,
  goalId,
  waitsForNotice = false,
}: {
  context: GoalRunContext;
  goalId: string;
  waitsForNotice?: boolean;
}) {
  await goalProgressStep({ entityId: goalId, status: "started", step: "preparePlacement" });

  await startOnce(
    placementItemsWorkflow,
    [{ analytics: context.analytics, goalId, waitsForNotice }],
    `placement-items:${goalId}`,
  );
}
