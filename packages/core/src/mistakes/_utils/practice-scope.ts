import "server-only";
import {
  loadLearnerListeningSkillIds,
  loadListeningSkillIds,
} from "../../exams/listening/listening-skills";
import { getSkillOwners, loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";

/** What a run on this goal may ask and fix, or null when the goal isn't the learner's. */
export async function resolvePracticeScope({
  goalId,
  userId,
}: {
  goalId: string | undefined;
  userId: string;
}) {
  // Unscoped practice must respect listening-only skills from any of the learner's goals.
  if (!goalId) {
    return {
      goal: null,
      listeningSkillIds: await loadLearnerListeningSkillIds(userId),
      ownerOf: new Map<string, string>(),
      skillIds: null,
    };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return null;
  }

  const [plan, listeningSkillIds] = await Promise.all([
    loadGoalPlan(goalId),
    loadListeningSkillIds(goalId),
  ]);

  const ownerOf = getSkillOwners(plan.skills);

  return { goal: owned.goal, listeningSkillIds, ownerOf, skillIds: [...ownerOf.keys()] };
}
