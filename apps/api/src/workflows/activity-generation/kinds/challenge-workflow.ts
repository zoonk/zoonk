import { generateChallengeContentStep } from "../steps/generate-challenge-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveChallengeActivityStep } from "../steps/save-challenge-activity-step";

/**
 * Orchestrates challenge activity generation.
 *
 * Flow: generateContent → save.
 * The generate step produces data only; the save step writes everything
 * (intro + decision steps + reflection) and marks the activity as completed.
 */
export async function challengeActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  const { activityId, data } = await generateChallengeContentStep(
    activities,
    concepts,
    neighboringConcepts,
  );

  if (!activityId || !data) {
    return;
  }

  await saveChallengeActivityStep({
    activityId,
    data,
    workflowRunId,
  });
}
