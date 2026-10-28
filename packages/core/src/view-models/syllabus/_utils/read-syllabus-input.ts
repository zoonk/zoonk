import "server-only";
import { readOwnedGoal } from "../../../learner/facts/owned-goal";
import { readSavedPlan } from "../../../learner/facts/saved-plan";
import { readExamBlueprint } from "../../../library/exams/read-exam-blueprint";
import { tagViewGoalReads } from "../../_utils/resolve-view-goal";
import { loadSyllabusInput } from "./load-syllabus";

/** Caller must resolve ownership; private-cache keys share one plan/answer snapshot across page readers. */
export async function readSyllabusInput(userId: string, goalId: string) {
  "use cache: private";

  tagViewGoalReads(userId);

  // The plan is read beside the goal and used only once the goal is the learner's.
  const [goal, savedPlan] = await Promise.all([
    readOwnedGoal(userId, goalId),
    readSavedPlan(userId, goalId),
  ]);

  if (!goal) {
    return null;
  }

  return loadSyllabusInput(goal, {
    blueprint:
      goal.kind === "exam" && goal.examBlueprintId ? readExamBlueprint(goal.examBlueprintId) : null,
    savedPlan,
  });
}
