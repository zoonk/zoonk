import { completeActivityStep } from "../steps/complete-activity-step";
import { generateLanguagePracticeContentStep } from "../steps/generate-language-practice-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function languagePracticeActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  await generateLanguagePracticeContentStep(
    activities,
    workflowRunId,
    concepts,
    neighboringConcepts,
  );
  await completeActivityStep(activities, workflowRunId, "languagePractice");
}
