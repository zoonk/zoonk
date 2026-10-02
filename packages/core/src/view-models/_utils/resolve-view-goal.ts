import "server-only";
import { type Goal } from "@zoonk/db";
import { cacheTag } from "next/cache";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getSession } from "../../users/get-session";

export type ViewGoalResult =
  | { goal: Goal; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/**
 * The goal a tab shows: the one asked for, or the learner's active goal (the one picked in the
 * goal switcher, else their first active goal). A learner without one gets `noGoal`, which the
 * apps turn into "start a goal". Call it from a `"use cache: private"`
 * view model: it tags the cache with everything a tab reads (the active goal, the plan, the
 * learner model and finished lessons), so any of them changing refreshes the tab.
 */
export async function resolveViewGoal(goalId?: string): Promise<ViewGoalResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  cacheTag(
    getGoalsCacheTag(userId),
    getLearnerModelCacheTag(userId),
    getLearningProfileCacheTag(userId),
    getUserProgressCacheTag(userId),
  );

  const id = goalId ?? (await findActiveGoalId(userId));

  if (!id) {
    return { status: "noGoal" };
  }

  const owned = await findOwnedGoal(id);

  return owned.status === "ready" ? { goal: owned.goal, status: "ready" } : owned;
}
