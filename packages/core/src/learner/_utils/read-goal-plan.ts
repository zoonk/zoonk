import "server-only";
import { cacheTag } from "next/cache";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { readSavedPlan } from "../facts/saved-plan";
import { type GoalPlan, loadGoalPlan } from "./goal-skill-graph";

/** GETs only, after ownership authorization; mutations must use loadGoalPlan for fresh reads. */
export async function readGoalPlan(goalId: string): Promise<GoalPlan> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return loadGoalPlan(goalId);
  }

  const userId = session.user.id;

  cacheTag(
    getGoalsCacheTag(userId),
    getLearnerModelCacheTag(userId),
    getLearningProfileCacheTag(userId),
    getUserProgressCacheTag(userId),
  );

  const saved = await readSavedPlan(userId, goalId);
  return saved ? loadGoalPlan(goalId, saved, { sharedLibrary: true }) : { items: [], skills: [] };
}
