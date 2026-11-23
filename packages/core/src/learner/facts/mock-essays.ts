import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadMockEssays } from "../../exams/mocks/_utils/mock-essays";
import { type MockEssayCandidate } from "../../exams/mocks/written-parts";

export async function readMockEssays(
  userId: string,
  goalId: string,
  examBlueprintId: string | null,
): Promise<MockEssayCandidate[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  return loadMockEssays({ goal: { examBlueprintId, id: goalId }, userId });
}
