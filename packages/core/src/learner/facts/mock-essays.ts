import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadMockEssays } from "../../exams/mocks/_utils/mock-essays";
import { type MockEssayCandidate } from "../../exams/mocks/written-parts";
import { readSavedPlan } from "./saved-plan";

/**
 * Internal GET fact: the exam's essays for the learner's mocks, the ones written longest ago
 * first, read once per request for the weekly mock's card and the mocks taken any time. The caller
 * resolved the goal as the learner's; starting a mock reads them fresh.
 */
export async function readMockEssays(
  userId: string,
  goalId: string,
  examBlueprintId: string | null,
): Promise<MockEssayCandidate[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const plan = await readSavedPlan(userId, goalId);

  return loadMockEssays({ goal: { examBlueprintId, id: goalId }, plan: plan ?? undefined, userId });
}
