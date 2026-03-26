import { generateCustomContentStep } from "../steps/generate-custom-content-step";
import { generateCustomImagesStep } from "../steps/generate-custom-images-step";
import { generateCustomVisualsStep } from "../steps/generate-custom-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveCustomActivityStep } from "../steps/save-custom-activity-step";

/**
 * Orchestrates custom activity generation with per-entity save.
 *
 * Flow: generateContent → generateVisuals → generateImages → save per entity.
 * Each entity is independent — if one fails, others continue.
 */
export async function customActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use workflow";

  const customContent = await generateCustomContentStep(activities);
  const customVisuals = await generateCustomVisualsStep(activities, customContent);
  const customImages = await generateCustomImagesStep(activities, customVisuals);

  await Promise.allSettled(
    customContent.map(async (contentResult) => {
      const imageResult = customImages.find((img) => img.activityId === contentResult.activityId);
      const completedRows = imageResult?.completedRows ?? [];

      try {
        await saveCustomActivityStep({
          activityId: contentResult.activityId,
          completedRows,
          contentSteps: contentResult.steps,
          workflowRunId,
        });
      } catch {
        await handleActivityFailureStep({ activityId: contentResult.activityId });
      }
    }),
  );
}
