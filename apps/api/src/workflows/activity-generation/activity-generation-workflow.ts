import { getWorkflowMetadata } from "workflow";
import { generateBackgroundContentStep } from "./steps/generate-background-content-step";
import { generateExplanationContentStep } from "./steps/generate-explanation-content-step";
import { generateImagesStep } from "./steps/generate-images-step";
import { generateVisualsStep } from "./steps/generate-visuals-step";
import { getLessonActivitiesStep } from "./steps/get-lesson-activities-step";
import { saveActivityStep } from "./steps/save-activity-step";

export async function activityGenerationWorkflow(lessonId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const activities = await getLessonActivitiesStep(lessonId);

  const backgroundContent = await generateBackgroundContentStep(activities, workflowRunId);

  const [backgroundVisuals, explanationContent] = await Promise.all([
    generateVisualsStep(activities, backgroundContent.steps, "background"),
    generateExplanationContentStep(activities, backgroundContent.steps, workflowRunId),
  ]);

  const [backgroundImages, explanationVisuals] = await Promise.all([
    generateImagesStep(activities, backgroundVisuals.visuals, "background"),
    generateVisualsStep(activities, explanationContent.steps, "explanation"),
  ]);

  const [, explanationImages] = await Promise.all([
    saveActivityStep(
      activities,
      backgroundContent.steps,
      backgroundImages,
      workflowRunId,
      "background",
    ),
    generateImagesStep(activities, explanationVisuals.visuals, "explanation"),
  ]);

  await saveActivityStep(
    activities,
    explanationContent.steps,
    explanationImages,
    workflowRunId,
    "explanation",
  );
}
