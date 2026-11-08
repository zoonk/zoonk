import { waitForRunToken } from "../_shared/run-token";
import { getGoalContentToken, goalContentWorkflow } from "./goal-content-workflow";
import { loadGoalCurriculumStep } from "./steps/goal-curriculum-steps";

export async function rebuildGoalCurriculumWorkflow({ goalId }: { goalId: string }) {
  "use workflow";

  if (!(await waitForRunToken(getGoalContentToken({ goalId })))) {
    throw new Error(`The initial curriculum is still being written for ${goalId}`);
  }

  if (!(await waitForRunToken(getGoalContentToken({ goalId, rebuild: true })))) {
    throw new Error(`The curriculum is still being rebuilt for ${goalId}`);
  }

  const inputs = await loadGoalCurriculumStep(goalId);
  return goalContentWorkflow({ goalId, rebuild: inputs?.hasPlanGraph ?? false });
}
