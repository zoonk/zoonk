import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../cache/tags";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { findActiveGoalId, loadGoalViews } from "./_utils/goal-view";
import { type GoalView } from "./goal-contract";

export type GoalResult =
  | { goal: GoalView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** One of the learner's goals with a short summary of its plan. */
export async function getGoal(goalId: string): Promise<GoalResult> {
  "use cache: private";

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  cacheTag(getGoalsCacheTag(owned.userId), getLearningProfileCacheTag(owned.userId));

  const activeGoalId = await findActiveGoalId(owned.userId);
  const [goal] = await loadGoalViews({ activeGoalId, goals: [owned.goal] });

  return goal ? { goal, status: "ready" } : { status: "notFound" };
}
