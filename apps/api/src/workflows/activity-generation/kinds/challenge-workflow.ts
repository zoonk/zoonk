import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { generateChallengeContentStep } from "../steps/generate-challenge-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveChallengeActivityStep } from "../steps/save-challenge-activity-step";

/**
 * Orchestrates challenge activity generation.
 *
 * Flow: generateContent -> save.
 * The generate step produces data only; the save step writes everything
 * (intro + decision steps + reflection) and marks the activity as completed.
 *
 * Only generates if the challenge activity is in the activitiesToGenerate list.
 */
export async function challengeActivityWorkflow({
  activitiesToGenerate,
  concepts,
  neighboringConcepts,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  concepts: string[];
  neighboringConcepts: string[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const challengeActivity = findActivityByKind(activitiesToGenerate, "challenge");

  if (!challengeActivity) {
    return;
  }

  const { activityId, data } = await generateChallengeContentStep(
    challengeActivity,
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
