import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { findGoalCourses } from "../goals/goal-courses";
import { buildGoalSkillGraph } from "../goals/goal-skill-graph";
import { loadGoalCurriculumStep } from "../goals/steps/goal-curriculum-steps";

export async function skillGraphTestWorkflow(
  goalId: string,
  privateGraph = false,
  saveCourses = false,
) {
  "use workflow";

  const inputs = await loadGoalCurriculumStep(goalId);

  if (!inputs) {
    throw new Error("Missing goal");
  }

  const scope: CurriculumScope = {
    generalGoal: inputs.goal.title,
    language: inputs.goal.language,
    ownerId: privateGraph ? inputs.goal.userId : null,
    targetLanguage: null,
  };

  const built = await buildGoalSkillGraph({ inputs, scope, workflowRunId: "graph-test" });

  if (!saveCourses) {
    return built;
  }

  const courseIdsByKey = await findGoalCourses({
    courses: built.graph.courses,
    goal: inputs.goal,
    product: inputs.product,
    provenance: built.provenance,
    resolved: built.courseIdsByKey,
    scope,
    workflowRunId: "graph-test",
  });

  return { ...built, courseIdsByKey };
}
