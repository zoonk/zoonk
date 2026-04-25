import { settledValues } from "@zoonk/utils/settled";
import { failActivityWorkflow } from "../handle-activity-workflow-error";
import { getExistingContentSteps } from "../steps/_utils/content-step-helpers";
import { findActivitiesByKind } from "../steps/_utils/find-activity-by-kind";
import { generateActivityStepImagesStep } from "../steps/generate-activity-step-images-step";
import {
  type ExplanationResult,
  type GeneratedExplanationResult,
  generateExplanationContentStep,
} from "../steps/generate-explanation-content-step";
import { generateExplanationImagePromptsStep } from "../steps/generate-explanation-image-prompts-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveExplanationActivityStep } from "../steps/save-explanation-activity-step";

/**
 * Builds explanation results from completed activities by reading their
 * existing steps from the database. This allows downstream workflows
 * (practice, quiz) to use explanation data even when the explanation
 * activity was already completed in a prior run.
 */
async function getResultsFromCompletedActivities(
  allActivities: LessonActivity[],
  activitiesToGenerate: LessonActivity[],
): Promise<ExplanationResult[]> {
  const allExplanations = findActivitiesByKind(allActivities, "explanation");
  const toGenerateIds = new Set(activitiesToGenerate.map((a) => a.id));

  const completedExplanations = allExplanations.filter(
    (a) => a.generationStatus === "completed" && !toGenerateIds.has(a.id),
  );

  const results = await Promise.all(
    completedExplanations.map(async (activity) => {
      const steps = await getExistingContentSteps(activity.id);
      return { activityId: activity.id, concept: activity.title ?? "", steps };
    }),
  );

  return results;
}

/**
 * Orchestrates explanation activity generation with per-entity save.
 *
 * Flow per entity:
 *   generateContent -> generateImagePrompts -> generateStepImages -> save.
 *
 * The explanation task produces the ordered learner flow, while the shared
 * image-prompt task decides what to illustrate for each step.
 *
 * Each entity is independent — if one fails, others continue.
 * The save step writes all data (content + step images) at once
 * and marks the activity as completed.
 *
 * Returns results from BOTH generated and completed activities so downstream
 * workflows (practice, quiz) have all the explanation data they need.
 */
export async function explanationActivityWorkflow({
  activitiesToGenerate,
  allActivities,
  lessonConcepts,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  allActivities: LessonActivity[];
  lessonConcepts: string[];
  workflowRunId: string;
}): Promise<{ results: ExplanationResult[] }> {
  "use workflow";

  const explanationsToGenerate = findActivitiesByKind(activitiesToGenerate, "explanation");

  const [completedResults, generatedSettledResults] = await Promise.all([
    getResultsFromCompletedActivities(allActivities, activitiesToGenerate),
    Promise.allSettled(
      explanationsToGenerate.map(async (activity): Promise<GeneratedExplanationResult> => {
        try {
          const result = await generateExplanationContentStep({
            activity,
            allActivities,
            lessonConcepts,
          });

          const { prompts } = await generateExplanationImagePromptsStep(activity, result.steps);
          const { images } = await generateActivityStepImagesStep(activity, prompts);

          await saveExplanationActivityStep({
            activityId: result.activityId,
            images,
            steps: result.steps,
            workflowRunId,
          });

          return result;
        } catch (error) {
          return failActivityWorkflow({ activityId: activity.id, error });
        }
      }),
    ),
  ]);

  const generatedResults = settledValues(generatedSettledResults);

  return { results: [...completedResults, ...generatedResults] };
}
