import { createGoalPlan } from "../create-goal-plan";
import { claimNoticeLanding, endNoticeWait, startNoticeWait } from "../notice-wait";
import { type PlanGraph } from "../planner/plan-state";

/**
 * Research's reading of the notice lands while the reveal still waits for it, as the research
 * workflow lands it: the plan waits, the reading claims the wait (see `claimNoticeLanding`), the
 * plan follows the notice (`followNotice`), then stops waiting.
 */
export async function followNoticeReading({ goalId, graph }: { goalId: string; graph: PlanGraph }) {
  await startNoticeWait({ goalId });
  await claimNoticeLanding({ goalId });

  const followed = await createGoalPlan({ followNotice: true, goalId, graph });
  await endNoticeWait(goalId);

  return followed;
}
