import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadClaimEvents } from "../_utils/load-skill-claims";
import { type ClaimEvent } from "../_utils/skill-claims";
import { readPlanClaimEvents } from "./plan-claim-events";

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

  return loadClaimEvents({
    goalId,
    planEvents: readPlanClaimEvents(userId, goalId),
    skillIds,
    userId,
  });
}
