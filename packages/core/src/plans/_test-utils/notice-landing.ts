import { createGoalPlan } from "../create-goal-plan";
import { claimNoticeLanding, endNoticeWait, startNoticeWait } from "../notice-wait";
import { type PlanGraph } from "../planner/plan-state";

export async function followNoticeReading({ goalId, graph }: { goalId: string; graph: PlanGraph }) {
  await startNoticeWait({ goalId });
  await claimNoticeLanding({ goalId });

  const followed = await createGoalPlan({ followNotice: true, goalId, graph });
  await endNoticeWait(goalId);

  return followed;
}
