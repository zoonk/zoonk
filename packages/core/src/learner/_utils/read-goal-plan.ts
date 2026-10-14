import "server-only";
import { cacheTag } from "next/cache";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { type GoalPlan, loadGoalPlan } from "./goal-skill-graph";

/**
 * `loadGoalPlan` for the reads a page renders, which ask for the same goal's skills several times
 * (the Plan's progress, skills, mistakes and map): loaded once per request and tagged like the
 * tabs' reads (`resolveViewGoal`), so whatever clears them clears it too. Mutations call
 * `loadGoalPlan`, whose reads after their own writes must see them. The caller has checked the
 * goal is the learner's.
 */
export async function readGoalPlan(goalId: string): Promise<GoalPlan> {
  "use cache: private";

  const session = await getSession();

  if (session) {
    const userId = session.user.id;

    cacheTag(
      getGoalsCacheTag(userId),
      getLearnerModelCacheTag(userId),
      getLearningProfileCacheTag(userId),
      getUserProgressCacheTag(userId),
    );
  }

  return loadGoalPlan(goalId);
}
