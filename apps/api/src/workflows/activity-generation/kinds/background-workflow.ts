import { completeActivityStep } from "../steps/complete-activity-step";
import { generateBackgroundContentStep } from "../steps/generate-background-content-step";
import { generateImagesStep } from "../steps/generate-images-step";
import { generateVisualsStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function backgroundActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  const { steps } = await generateBackgroundContentStep(
    activities,
    concepts,
    neighboringConcepts,
    workflowRunId,
  );

  const { visuals } = await generateVisualsStep(activities, steps, "background");
  await generateImagesStep(activities, visuals, "background");
  await completeActivityStep(activities, workflowRunId, "background");
}
