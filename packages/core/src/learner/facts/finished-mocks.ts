import "server-only";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { countFinishedMocksBefore } from "../../exams/mocks/_utils/mock-number";

/** GET-only fact after ownership authorization; starting or numbering a mock counts fresh. */
export async function readFinishedMockCount(userId: string, goalId: string): Promise<number> {
  "use cache: private";

  cacheTag(getLearnerModelCacheTag(userId));

  return countFinishedMocksBefore({ goalId });
}
