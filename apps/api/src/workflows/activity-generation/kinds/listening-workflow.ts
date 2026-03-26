import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveListeningActivityStep } from "../steps/save-listening-activity-step";

/**
 * Orchestrates listening activity generation.
 *
 * Listening activities mirror reading activities' sentences with audio-only steps.
 * The save step copies reading steps, creates listening steps, and marks
 * the activity as completed — all in one operation.
 *
 * Uses allActivities (not activitiesToGenerate) because the listening save step
 * needs to find the reading activity to copy its steps, regardless of whether
 * reading was generated in this run or was already completed.
 */
export async function listeningActivityWorkflow({
  allActivities,
  workflowRunId,
}: {
  allActivities: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  await saveListeningActivityStep(allActivities, workflowRunId);
}
