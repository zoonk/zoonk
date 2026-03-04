import { completeActivityStep } from "../steps/complete-activity-step";
import { generateLanguageStoryContentStep } from "../steps/generate-language-story-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function languageStoryActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  await generateLanguageStoryContentStep(activities, workflowRunId, concepts, neighboringConcepts);
  await completeActivityStep(activities, workflowRunId, "languageStory");
}
