import { generateCustomContentStep } from "./steps/generate-custom-content-step";
import { generateCustomImagesStep } from "./steps/generate-custom-images-step";
import { generateCustomVisualsStep } from "./steps/generate-custom-visuals-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { saveCustomActivitiesStep } from "./steps/save-custom-activities-step";

export async function customActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  const customContent = await generateCustomContentStep(activities, workflowRunId);
  const customVisuals = await generateCustomVisualsStep(activities, customContent);
  await generateCustomImagesStep(activities, customVisuals);
  await saveCustomActivitiesStep(activities, workflowRunId);
}
