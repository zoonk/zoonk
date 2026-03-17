import { completeActivityStep } from "../steps/complete-activity-step";
import { generateLanguagePracticeAudioStep } from "../steps/generate-language-practice-audio-step";
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
  await generateLanguagePracticeAudioStep(activities);
  await completeActivityStep(activities, workflowRunId, "languagePractice");
}
