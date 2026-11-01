import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadCatchUpItems } from "../../sessions/_utils/catch-up";

/** GET-only fact after ownership authorization; writes call `loadCatchUpItems` for fresh reads. */
export async function readCatchUpItems(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  return loadCatchUpItems(goalId);
}
