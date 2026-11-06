import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadGoalListeningSkillIds } from "../../exams/listening/listening-skills";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import {
  type PracticeMistake,
  loadPracticeMistakes,
} from "../../mistakes/mistake-practice-eligibility";
import { getSkillOwners } from "../_utils/goal-skill-graph";
import { readGoalPlan } from "../_utils/read-goal-plan";
import { readOwnedGoal } from "./owned-goal";
import { readSavedPlan } from "./saved-plan";

/** GET-only fact after ownership authorization; writes call `loadPracticeMistakes` for fresh reads. */
export async function readPracticeMistakes(
  userId: string,
  goalId: string,
): Promise<PracticeMistake[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const [goal, plan, saved] = await Promise.all([
    readOwnedGoal(userId, goalId),
    readGoalPlan(goalId),
    readSavedPlan(userId, goalId),
  ]);

  if (!goal) {
    return [];
  }

  const listeningSkillIds = await loadGoalListeningSkillIds({
    blueprint: goal.examBlueprintId ? await readExamBlueprint(goal.examBlueprintId) : null,
    goal,
    graph: saved?.graph ?? null,
  });

  return loadPracticeMistakes({
    goal,
    listeningSkillIds,
    ownerOf: getSkillOwners(plan.skills),
    userId,
  });
}
