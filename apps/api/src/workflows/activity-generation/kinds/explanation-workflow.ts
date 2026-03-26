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
 * Orchestrates explanation activity generation with per-entity save.
 *
 * Flow per entity: generateContent → generateVisuals → generateImages → save.
 * Each entity is independent — if one fails, others continue.
 * The save step writes all data (content + visuals + images) at once
 * and marks the activity as completed.
 */
export async function explanationActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<{ results: ExplanationResult[] }> {
  "use workflow";

  const { results } = await generateExplanationContentStep(
    activities,
    concepts,
    neighboringConcepts,
  );

  await Promise.allSettled(
    results.map(async (result) => {
      const activity = activities.find((a) => a.id === result.activityId);

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

  return { results };
}
