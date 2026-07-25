import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import {
  type TotalLearningDaysData,
  getTotalLearningDays as queryTotalLearningDays,
} from "@zoonk/core/progress/metrics";
import { cacheTag } from "next/cache";

/** Returns the lifetime learning-day total for an explicit learner identity. */
export async function getTotalLearningDaysForUser(userId: string): Promise<TotalLearningDaysData> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  return queryTotalLearningDays({ userId });
}
