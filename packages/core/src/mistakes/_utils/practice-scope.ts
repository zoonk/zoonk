import "server-only";
import { getSkillOwners, loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";

/** What a run on this goal may ask and fix, or null when the goal isn't the learner's. */
export async function resolvePracticeScope({ goalId }: { goalId: string | undefined }) {
  if (!goalId) {
    return { goal: null, skillIds: null };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return null;
  }

  const plan = await loadGoalPlan(goalId);

  const ownerOf = getSkillOwners(plan.skills);

  return { goal: owned.goal, skillIds: [...ownerOf.keys()] };
}
