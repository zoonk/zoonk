import { failActivityWorkflow } from "../handle-activity-workflow-error";
import { generateCustomContentStep } from "../steps/generate-custom-content-step";
import { generateCustomImagePromptsStep } from "../steps/generate-custom-image-prompts-step";
import { generateCustomStepImagesStep } from "../steps/generate-custom-step-images-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveCustomActivityStep } from "../steps/save-custom-activity-step";

/**
 * Orchestrates custom activity generation with per-entity save.
 *
 * Flow: generateContent -> generateImagePrompts -> generateStepImages -> save per entity.
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

  await Promise.allSettled(
    customActivitiesToGenerate.map(async (activity) => {
      try {
        const contentResult = await generateCustomContentStep(activity);
        const promptResult = await generateCustomImagePromptsStep(activity, contentResult);
        const { images } = await generateCustomStepImagesStep(activity, promptResult);

        await saveCustomActivityStep({
          activityId: contentResult.activityId,
          contentSteps: contentResult.steps,
          images,
          workflowRunId,
        });
      } catch (error) {
        await failActivityWorkflow({ activityId: activity.id, error });
      }
    }),
  );
}
