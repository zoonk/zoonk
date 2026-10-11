import "server-only";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { moveGoalTimeZone } from "./_utils/goal-time-zone";
import { findOwnedGoal } from "./_utils/owned-goal";

export type FollowGoalTimeZoneResult =
  | { moved: boolean; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Follows the learner to their device's zone when a screen of the goal opens: a goal without a
 * zone stores it, and a learner who moved takes it while nothing was done yet in the goal's day
 * (see `moveGoalTimeZone`). `moved` says the day may have changed, so the screen reads itself again.
 */
export async function followGoalTimeZone({
  goalId,
  timeZone,
}: {
  goalId: string;
  timeZone: string;
}): Promise<FollowGoalTimeZoneResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const moved = await moveGoalTimeZone({ goal: owned.goal, now: new Date(), timeZone });

  if (moved) {
    revalidateCacheTags([getGoalsCacheTag(owned.userId), getLearnerModelCacheTag(owned.userId)]);
  }

  return { moved, status: "ready" };
}
