import { completeListeningActivityStep } from "../steps/complete-listening-activity-step";
import { copyListeningStepsStep } from "../steps/copy-listening-steps-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function listeningActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use workflow";

  await copyListeningStepsStep(activities, workflowRunId);
  await completeListeningActivityStep(activities, workflowRunId);
}
