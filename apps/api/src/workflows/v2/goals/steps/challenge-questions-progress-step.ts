import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChallengeQuestionsStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

type ChallengeQuestionsStreamStep = ChallengeQuestionsStepName | typeof WORKFLOW_ERROR_STEP;

/** Writes one progress event of a challenge questions run to its stream. */
export async function challengeQuestionsProgressStep(
  message: StepStreamMessage<ChallengeQuestionsStreamStep>,
): Promise<void> {
  "use step";

  await using stream = createStepStream<ChallengeQuestionsStreamStep>();
  await stream.status(message);
}
