import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadUndoneTestOuts } from "../../plans/_utils/undone-test-outs";
import { type ClaimEvent } from "../_utils/skill-claims";

/** GET-only fact after ownership authorization; writes call `loadUndoneTestOuts` fresh. */
export async function readUndoneTestOuts(userId: string, goalId: string): Promise<ClaimEvent[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  return loadUndoneTestOuts(goalId);
}
