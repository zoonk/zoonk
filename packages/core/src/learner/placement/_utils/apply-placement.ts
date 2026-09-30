import "server-only";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../../cache/tags";
import { type GoalPlan, loadGoalPlan } from "../../_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../../_utils/known-skills";
import { type PlacementState, loadPlacementState } from "./load-placement-state";

/**
 * Applies what placement knows: skills it's sure the learner can do become known in the learner
 * model, and plan items teaching only known skills are tested out, which the plan announces with an
 * undo. Returns the placement it applied and the plan items it tested out.
 */
export async function applyPlacement({
  goalId,
  now,
  plan,
  timeZone,
  userId,
}: {
  goalId: string;
  now: Date;
  plan?: GoalPlan;
  timeZone: string;
  userId: string;
}): Promise<{ state: PlacementState; testedOutPlanItemIds: string[] }> {
  const goalPlan = plan ?? (await loadGoalPlan(goalId));
  const state = await loadPlacementState({ goalId, plan: goalPlan, userId });

  await markSkillsKnown({ knownAt: now, skillIds: state.knownSkillIds, timeZone, userId });

  const testedOutPlanItemIds = await markPlanItemsTestedOut({
    goalId,
    items: goalPlan.items,
    knownSkillIds: new Set(state.knownSkillIds),
    testedOutAt: now,
    timeZone,
  });

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);

  return { state, testedOutPlanItemIds };
}
