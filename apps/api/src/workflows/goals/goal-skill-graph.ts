import { generateGoalSkillGraph } from "@zoonk/core/library/curriculum/generate-goal-skill-graph";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { findGoalCourses } from "./goal-courses";
import { goalProgressStep } from "./steps/goal-progress-step";
import {
  findGraphLibraryStep,
  prepareSkillGraphStep,
  writeGraphFrameStep,
  writeGraphSectionStep,
  writeWholeGraphStep,
} from "./steps/skill-graph-steps";

export async function buildGoalSkillGraph(input: {
  analytics?: ContentAnalytics;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
  workflowRunId: string;
}) {
  const { examBlueprintId, model, params } = await prepareSkillGraphStep(input);
  const goalId = input.inputs.goal.id;

  const { courseIdsByKey, data, provenance } = await generateGoalSkillGraph({
    model,
    params: {
      ...params,
      findLibrarySkills: examBlueprintId
        ? async ({ courses, provenance: frameProvenance }) => {
            const resolved = await findGoalCourses({
              ...input,
              courses,
              goal: input.inputs.goal,
              provenance: frameProvenance,
            });

            return findGraphLibraryStep({
              courseIdsByKey: resolved,
              examBlueprintId,
              language: input.scope.language,
            });
          }
        : undefined,
    },
    tasks: {
      frame: (call) => writeGraphFrameStep({ goalId, params: { ...params, model: call.model } }),
      section: ({ params: call, part }) =>
        writeGraphSectionStep({ goalId, params: { ...params, model: call.model }, part }),
      whole: (call) => writeWholeGraphStep({ goalId, params: { ...params, model: call.model } }),
    },
  });

  await goalProgressStep({ entityId: goalId, status: "completed", step: "buildSkillGraph" });
  return { courseIdsByKey, graph: data, provenance };
}
