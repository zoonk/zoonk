import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { buildGoalSkillGraph } from "../goals/goal-skill-graph";
import { loadGoalCurriculumStep } from "../goals/steps/goal-curriculum-steps";

export async function skillGraphTestWorkflow(goalId: string, privateGraph = false) {
  "use workflow";

  const inputs = await loadGoalCurriculumStep(goalId);

  if (!inputs) {
    throw new Error("Missing goal");
  }

  const scope: CurriculumScope = {
    generalGoal: inputs.goal.title,
    language: "en",
    ownerId: privateGraph ? inputs.goal.userId : null,
    targetLanguage: null,
  };

  return buildGoalSkillGraph({ inputs, scope, workflowRunId: "graph-test" });
}
