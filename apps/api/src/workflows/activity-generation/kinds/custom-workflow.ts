import { generateCustomContentStep } from "../steps/generate-custom-content-step";
import { generateCustomVisualContentStep } from "../steps/generate-custom-visual-content-step";
import { generateCustomVisualDescriptionsStep } from "../steps/generate-custom-visuals-step";
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
 * Flow: generateContent -> generateVisualDescriptions -> generateVisualContent -> save per entity.
 *
 * Visual descriptions (stage 1) select the best visual kind for each step.
 * Visual content (stage 2) dispatches to per-kind tasks in parallel,
 * including image generation for image kinds.
 *
 * Each entity is independent — if one fails, others continue.
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

  const customDescriptions = await generateCustomVisualDescriptionsStep(
    customActivitiesToGenerate,
    customContent,
  );
  const customVisuals = await generateCustomVisualContentStep(
    customActivitiesToGenerate,
    customDescriptions,
  );

  await Promise.allSettled(
    customContent.map(async (contentResult) => {
      const visualResult = customVisuals.find((vis) => vis.activityId === contentResult.activityId);
      const completedRows = visualResult?.completedRows ?? [];

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
