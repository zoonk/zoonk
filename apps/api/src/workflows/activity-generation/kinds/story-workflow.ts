import { completeActivityStep } from "../steps/complete-activity-step";
import { generateStoryContentStep } from "../steps/generate-story-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function storyActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  await generateStoryContentStep(activities, concepts, neighboringConcepts, workflowRunId);
  await completeActivityStep(activities, workflowRunId, "story");
}
