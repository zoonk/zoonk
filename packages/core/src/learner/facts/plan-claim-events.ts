import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadPlanClaimEvents } from "../_utils/load-skill-claims";
import { type ClaimEvent } from "../_utils/skill-claims";
import { readSavedPlan } from "./saved-plan";

/** GET-only fact after ownership authorization; writes call `loadPlanClaimEvents` fresh. */
export async function readPlanClaimEvents(userId: string, goalId: string): Promise<ClaimEvent[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  return loadPlanClaimEvents({ goalId, plan: await readSavedPlan(userId, goalId) });
}
