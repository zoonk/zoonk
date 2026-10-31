import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadMockEssays } from "../../exams/mocks/_utils/mock-essays";
import { type MockEssayCandidate } from "../../exams/mocks/written-parts";
import { readSavedPlan } from "./saved-plan";

/** GET-only fact after ownership authorization; starts must read fresh. Essays are oldest first. */
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
