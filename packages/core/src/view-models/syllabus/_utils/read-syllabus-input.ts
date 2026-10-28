import "server-only";
import { readExamBlueprint } from "../../../learner/facts/exam-blueprint";
import { readOwnedGoal } from "../../../learner/facts/owned-goal";
import { tagViewGoalReads } from "../../_utils/resolve-view-goal";
import { loadSyllabusInput } from "./load-syllabus";

/**
 * A goal's syllabus input once per request, for the reads a page renders: a page shows the
 * syllabus and numbers its chapters (the Plan, a subject, the mind maps, a chapter) from the same
 * plan and the same answers, and each read built it on its own. Keyed by primitives so every
 * reader shares it; the caller resolved the goal as the learner's.
 */
export async function readSyllabusInput(userId: string, goalId: string) {
  "use cache: private";

  tagViewGoalReads(userId);

  const goal = await readOwnedGoal(userId, goalId);

  if (!goal) {
    return null;
  }

  return loadSyllabusInput(goal, {
    // Only an exam's notice reads it (see `loadNotice`), so it's read for exams alone.
    blueprint:
      goal.kind === "exam" && goal.examBlueprintId ? readExamBlueprint(goal.examBlueprintId) : null,
  });
}
