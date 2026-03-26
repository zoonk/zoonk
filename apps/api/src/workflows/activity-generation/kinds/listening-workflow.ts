import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveListeningActivityStep } from "../steps/save-listening-activity-step";

/**
 * Orchestrates listening activity generation.
 *
 * Listening activities mirror reading activities' sentences with audio-only steps.
 * The save step copies reading steps, creates listening steps, and marks
 * the activity as completed — all in one operation.
 */
export async function listeningActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use workflow";

  await saveListeningActivityStep(activities, workflowRunId);
}
