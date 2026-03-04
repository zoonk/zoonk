import { customActivityWorkflow as customWorkflow } from "./kinds/custom-workflow";
import { type LessonActivity } from "./steps/get-lesson-activities-step";

export async function customActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  await customWorkflow(activities, workflowRunId);
}
