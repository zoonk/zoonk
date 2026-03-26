import { generateCustomContentStep } from "../steps/generate-custom-content-step";
import { generateCustomImagesStep } from "../steps/generate-custom-images-step";
import { generateCustomVisualsStep } from "../steps/generate-custom-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveCustomActivityStep } from "../steps/save-custom-activity-step";

/**
 * Marks custom activities as failed when the content generation step
 * dropped their result (e.g., the AI call threw and Promise.allSettled
 * silently discarded the rejected promise). Without this, those activities
 * would stay "running" forever since no downstream step touches them.
 */
async function markDroppedCustomActivitiesAsFailed(
  activitiesToGenerate: LessonActivity[],
  contentResults: { activityId: number }[],
): Promise<void> {
  const customActivitiesToGenerate = activitiesToGenerate.filter((a) => a.kind === "custom");
  const resultActivityIds = new Set(contentResults.map((result) => result.activityId));

  await Promise.allSettled(
    customActivitiesToGenerate
      .filter((activity) => !resultActivityIds.has(activity.id))
      .map((activity) => handleActivityFailureStep({ activityId: activity.id })),
  );
}

/**
 * Orchestrates custom activity generation with per-entity save.
 *
 * Flow: generateContent -> generateVisuals -> generateImages -> save per entity.
 * Each entity is independent — if one fails, others continue.
 *
 * Only generates for custom activities in the activitiesToGenerate list.
 */
export async function customActivityWorkflow({
  activitiesToGenerate,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const customActivitiesToGenerate = activitiesToGenerate.filter((a) => a.kind === "custom");

  if (customActivitiesToGenerate.length === 0) {
    return;
  }

  const customContent = await generateCustomContentStep(customActivitiesToGenerate);

  await markDroppedCustomActivitiesAsFailed(activitiesToGenerate, customContent);

  const customVisuals = await generateCustomVisualsStep(customActivitiesToGenerate, customContent);
  const customImages = await generateCustomImagesStep(customActivitiesToGenerate, customVisuals);

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
