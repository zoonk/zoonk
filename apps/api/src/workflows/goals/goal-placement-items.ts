import { startOnce } from "../_shared/run-token";
import { type GoalRunContext } from "./goal-run-context";
import { placementItemsWorkflow } from "./placement-items-workflow";
import { requestGoalPlacementStep } from "./steps/goal-build-outcome-steps";
import { goalProgressStep } from "./steps/goal-progress-step";

export async function preparePlanPlacement({
  context,
  goalId,
  rebuild = false,
  waitsForNotice = false,
}: {
  context: GoalRunContext;
  goalId: string;
  rebuild?: boolean;
  waitsForNotice?: boolean;
}) {
  if (rebuild && !(await requestGoalPlacementStep(goalId))) {
    return;
  }

  await goalProgressStep({ entityId: goalId, status: "started", step: "preparePlacement" });

  await startOnce(
    placementItemsWorkflow,
    [{ analytics: context.analytics, goalId, waitsForNotice }],
    `placement-items:${goalId}${rebuild ? `:${context.workflowRunId}` : ""}`,
  );
}
