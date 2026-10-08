import { createStepStream } from "@/workflows/_shared/stream-status";
import { type GoalContentStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

export type GoalStreamStep = GoalContentStepName | typeof WORKFLOW_ERROR_STEP;

/** Writes one progress event of a goal's curriculum run to its stream. */
export async function goalProgressStep(message: StepStreamMessage<GoalStreamStep>): Promise<void> {
  "use step";

  await using stream = createStepStream<GoalStreamStep>();
  await stream.status(message);
}
