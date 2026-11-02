import "server-only";
import { type Goal } from "@zoonk/db";
import { cacheTag } from "next/cache";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserProgressCacheTag,
  getUserSubscriptionCacheTag,
} from "../../cache/tags";
import { readActiveGoal, readLearningProfile } from "../../learner/facts/learning-profile";
import { getOwnedGoal } from "../../learner/get-owned-goal";
import { getSession } from "../../users/get-session";

export function tagViewGoalReads(userId: string) {
  cacheTag(
    getGoalsCacheTag(userId),
    getLearnerModelCacheTag(userId),
    getLearningProfileCacheTag(userId),
    getUserProgressCacheTag(userId),
    getUserSubscriptionCacheTag(userId),
  );
}

export type ViewGoalResult =
  | { goal: Goal; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/** Call inside use cache: private; resolves an owned goal or active default and tags its dependent reads. */
export async function resolveViewGoal(goalId?: string): Promise<ViewGoalResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  tagViewGoalReads(userId);

  if (goalId === undefined) {
    const goal = await readActiveGoal(userId);

    if (goal) {
      return { goal, status: "ready" };
    }

    const profile = await readLearningProfile(userId);
    return { status: profile?.activeGoalId ? "notFound" : "noGoal" };
  }

  if (!goalId) {
    return { status: "noGoal" };
  }

  const owned = await getOwnedGoal(goalId);

  return owned.status === "ready" ? { goal: owned.goal, status: "ready" } : owned;
}
