import { completeActivityStep } from "../steps/complete-activity-step";
import { generateExamplesContentStep } from "../steps/generate-examples-content-step";
import { generateImagesStep } from "../steps/generate-images-step";
import { generateVisualsStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function examplesActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  const { steps } = await generateExamplesContentStep(
    activities,
    concepts,
    neighboringConcepts,
    workflowRunId,
  );

  const { visuals } = await generateVisualsStep(activities, steps, "examples");
  await generateImagesStep(activities, visuals, "examples");
  await completeActivityStep(activities, workflowRunId, "examples");
}
