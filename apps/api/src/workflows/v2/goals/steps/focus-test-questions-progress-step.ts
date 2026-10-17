import { createStepStream } from "@/workflows/_shared/stream-status";
import { type FocusTestQuestionsStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

type FocusTestQuestionsStreamStep = FocusTestQuestionsStepName | typeof WORKFLOW_ERROR_STEP;

/** Writes one progress event of a focus test questions run to its stream. */
export async function focusTestQuestionsProgressStep(
  message: StepStreamMessage<FocusTestQuestionsStreamStep>,
): Promise<void> {
  "use step";

  await using stream = createStepStream<FocusTestQuestionsStreamStep>();
  await stream.status(message);
}
