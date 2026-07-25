import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import {
  type TotalLearningTimeData,
  getTotalLearningTime as queryTotalLearningTime,
} from "@zoonk/core/progress/metrics";
import { cacheTag } from "next/cache";

/** Returns the lifetime learning duration for an explicit learner identity. */
export async function getTotalLearningTimeForUser(userId: string): Promise<TotalLearningTimeData> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  return queryTotalLearningTime({ userId });
}
