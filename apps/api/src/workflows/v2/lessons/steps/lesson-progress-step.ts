import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonContentStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

export type LessonStreamStep = LessonContentStepName | typeof WORKFLOW_ERROR_STEP;

/**
 * Writes one progress event to the run's stream. Workflow code can't touch streams, so events the
 * workflow itself decides on (joined, ready, failed) go through this step.
 */
export async function lessonProgressStep(
  message: StepStreamMessage<LessonStreamStep>,
): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status(message);
}
