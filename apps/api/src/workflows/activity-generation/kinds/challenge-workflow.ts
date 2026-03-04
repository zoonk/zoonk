import { completeActivityStep } from "../steps/complete-activity-step";
import { generateChallengeContentStep } from "../steps/generate-challenge-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function challengeActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  await generateChallengeContentStep(activities, concepts, neighboringConcepts, workflowRunId);
  await completeActivityStep(activities, workflowRunId, "challenge");
}
