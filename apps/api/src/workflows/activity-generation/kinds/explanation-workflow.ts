import { getExistingContentSteps } from "../steps/_utils/content-step-helpers";
import { findActivitiesByKind } from "../steps/_utils/find-activity-by-kind";
import {
  type ExplanationResult,
  generateExplanationContentStep,
} from "../steps/generate-explanation-content-step";
import { generateImagesForActivityStep } from "../steps/generate-images-step";
import { generateVisualsForActivityStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveExplanationActivityStep } from "../steps/save-explanation-activity-step";

/**
 * Marks explanation activities as failed when the content generation step
 * dropped their result (e.g., the AI call threw and Promise.allSettled
 * silently discarded the rejected promise). Without this, those activities
 * would stay "running" forever since no downstream step touches them.
 */
async function markDroppedExplanationsAsFailed(
  activitiesToGenerate: LessonActivity[],
  results: ExplanationResult[],
): Promise<void> {
  const explanationsToGenerate = findActivitiesByKind(activitiesToGenerate, "explanation");
  const resultActivityIds = new Set(results.map((result) => result.activityId));

  await Promise.allSettled(
    explanationsToGenerate
      .filter((activity) => !resultActivityIds.has(activity.id))
      .map((activity) => handleActivityFailureStep({ activityId: activity.id })),
  );
}

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
 * Flow per entity: generateContent -> generateVisuals -> generateImages -> save.
 * Each entity is independent — if one fails, others continue.
 * The save step writes all data (content + visuals + images) at once
 * and marks the activity as completed.
 *
 * Returns results from BOTH generated and completed activities so downstream
 * workflows (practice, quiz) have all the explanation data they need.
 */
export async function explanationActivityWorkflow({
  activitiesToGenerate,
  allActivities,
  concepts,
  neighboringConcepts,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  allActivities: LessonActivity[];
  concepts: string[];
  neighboringConcepts: string[];
  workflowRunId: string;
}): Promise<{ results: ExplanationResult[] }> {
  "use workflow";

  const explanationsToGenerate = findActivitiesByKind(activitiesToGenerate, "explanation");

  const [completedResults, generatedData] = await Promise.all([
    getResultsFromCompletedActivities(allActivities, activitiesToGenerate),
    explanationsToGenerate.length > 0
      ? generateExplanationContentStep(explanationsToGenerate, concepts, neighboringConcepts)
      : { results: [] },
  ]);

  const { results: generatedResults } = generatedData;

  await markDroppedExplanationsAsFailed(activitiesToGenerate, generatedResults);

  await Promise.allSettled(
    generatedResults.map(async (result) => {
      const activity = explanationsToGenerate.find((a) => a.id === result.activityId);

      if (!activity || result.steps.length === 0) {
        return;
      }

      try {
        const { visuals, visualRows } = await generateVisualsForActivityStep(
          activity,
          result.steps,
        );
        const { completedRows } = await generateImagesForActivityStep(
          activity,
          visuals,
          visualRows,
        );

        await saveExplanationActivityStep({
          activityId: result.activityId,
          completedRows,
          contentSteps: result.steps,
          workflowRunId,
        });
      } catch {
        await handleActivityFailureStep({ activityId: result.activityId });
      }
    }),
  );

  return { results: [...completedResults, ...generatedResults] };
}
