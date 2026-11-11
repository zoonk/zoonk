import "server-only";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { findLastCheckpointResults } from "../../checkpoints/_utils/checkpoint-results";

export async function readChallengeResults(userId: string, planItemIds: readonly string[]) {
  "use cache: private";
  cacheTag(getUserProgressCacheTag(userId));
  return findLastCheckpointResults({ planItemIds, userId });
}
