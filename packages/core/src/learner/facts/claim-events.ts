import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadClaimEvents } from "../_utils/load-skill-claims";
import { type ClaimEvent } from "../_utils/skill-claims";
import { readSavedPlan } from "./saved-plan";

/**
 * GET-only fact after ownership authorization; writes call `loadClaimEvents` fresh. Pass the skills
 * through `toIdKey`, so readers asking about the same skills share one read.
 */
export async function readClaimEvents(
  userId: string,
  goalId: string,
  skillIds: readonly string[],
): Promise<ClaimEvent[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const plan = await readSavedPlan(userId, goalId);

  return loadClaimEvents({ goalId, plan, skillIds, userId });
}
