import { createStepStream } from "@/workflows/_shared/stream-status";
import { type TestOutQuestionsStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

type TestOutQuestionsStreamStep = TestOutQuestionsStepName | typeof WORKFLOW_ERROR_STEP;

/** Writes one progress event of a test-out questions run to its stream. */
export async function testOutQuestionsProgressStep(
  message: StepStreamMessage<TestOutQuestionsStreamStep>,
): Promise<void> {
  "use step";

  await using stream = createStepStream<TestOutQuestionsStreamStep>();
  await stream.status(message);
}
