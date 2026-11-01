import "server-only";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag, getUserSubscriptionCacheTag } from "../../cache/tags";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { readGoalPlan } from "../_utils/read-goal-plan";
import { readOwnedGoal } from "./owned-goal";
import { getRequestInstant } from "./request-instant";
import { readSavedPlan } from "./saved-plan";
import { readActiveSubscription } from "./subscription";

/** GET-only fact after ownership authorization; writes call `loadPreparationInputs` for fresh reads. */
export async function readPreparationInputs(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getLearnerModelCacheTag(userId), getUserSubscriptionCacheTag(userId));

  const [goal, savedPlan, subscription, now] = await Promise.all([
    readOwnedGoal(userId, goalId),
    readSavedPlan(userId, goalId),
    readActiveSubscription(userId),
    getRequestInstant(),
  ]);

  return loadPreparationInputs({
    blueprint: goal?.examBlueprintId ? await readExamBlueprint(goal.examBlueprintId) : null,
    goal: goal ?? undefined,
    goalId,
    now,
    readPlan: readGoalPlan,
    savedPlan,
    subscription,
    userId,
  });
}
