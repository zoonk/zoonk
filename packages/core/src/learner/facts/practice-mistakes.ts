import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import {
  type PracticeMistake,
  loadPracticeMistakes,
} from "../../mistakes/mistake-practice-eligibility";
import { getSkillOwners } from "../_utils/goal-skill-graph";
import { readGoalPlan } from "../_utils/read-goal-plan";
import { readOwnedGoal } from "./owned-goal";

/** GET-only fact after ownership authorization; writes call `loadPracticeMistakes` for fresh reads. */
export async function readPracticeMistakes(
  userId: string,
  goalId: string,
): Promise<PracticeMistake[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const [goal, plan] = await Promise.all([readOwnedGoal(userId, goalId), readGoalPlan(goalId)]);

  if (!goal) {
    return [];
  }

  return loadPracticeMistakes({ skillIds: [...getSkillOwners(plan.skills).keys()], userId });
}
