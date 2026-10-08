import { createStepStream } from "@/workflows/_shared/stream-status";
import { type MockQuestionsStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

type MockQuestionsStreamStep = MockQuestionsStepName | typeof WORKFLOW_ERROR_STEP;

/** Writes one progress event of a mock questions run to its stream. */
export async function mockQuestionsProgressStep(
  message: StepStreamMessage<MockQuestionsStreamStep>,
): Promise<void> {
  "use step";

  await using stream = createStepStream<MockQuestionsStreamStep>();
  await stream.status(message);
}
