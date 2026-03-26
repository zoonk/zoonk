import { customActivityWorkflow as customWorkflow } from "./kinds/custom-workflow";
import { type LessonActivity } from "./steps/get-lesson-activities-step";

/**
 * Delegates to the custom kind workflow, passing through the subset
 * of activities that need generation.
 */
export async function customActivityWorkflow({
  activitiesToGenerate,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  await customWorkflow({ activitiesToGenerate, workflowRunId });
}
