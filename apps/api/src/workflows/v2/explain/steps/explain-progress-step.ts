import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ExplanationStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

export type ExplanationStreamStep = ExplanationStepName | typeof WORKFLOW_ERROR_STEP;

/** Writes one progress event of an explain run to its stream. */
export async function explainProgressStep(
  message: StepStreamMessage<ExplanationStreamStep>,
): Promise<void> {
  "use step";

  await using stream = createStepStream<ExplanationStreamStep>();
  await stream.status(message);
}
