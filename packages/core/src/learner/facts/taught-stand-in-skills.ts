import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { listTaughtStandInSkills } from "../../lookahead/plan-outline-needs";
import { readOwnedGoal } from "./owned-goal";
import { readSavedPlan } from "./saved-plan";

/** GET-only fact after ownership authorization: the saved plan's stand-in skills chapters already teach. */
export async function readTaughtStandInSkills(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const [goal, saved] = await Promise.all([
    readOwnedGoal(userId, goalId),
    readSavedPlan(userId, goalId),
  ]);

  if (!goal || !saved) {
    return new Set<string>();
  }

  return listTaughtStandInSkills({
    blueprint: goal.examBlueprintId ? await readExamBlueprint(goal.examBlueprintId) : null,
    goal,
    graph: saved.graph,
    items: saved.items,
  });
}
