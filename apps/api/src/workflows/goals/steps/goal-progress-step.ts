import { createStepStream } from "@/workflows/_shared/stream-status";
import { trackOnboardingProgress } from "@zoonk/core/analytics/track-onboarding-progress";
import { type GoalContentStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

export type GoalStreamStep = GoalContentStepName | typeof WORKFLOW_ERROR_STEP;

export async function goalProgressStep(
  message: StepStreamMessage<GoalStreamStep>,
  { last = false }: { last?: boolean } = {},
): Promise<void> {
  "use step";

  await using stream = createStepStream<GoalStreamStep>();
  const at = Date.now();
  await stream.status(message);

  if (message.entityId) {
    trackOnboardingProgress({
      at,
      deck_id: message.warmUpId,
      goalId: message.entityId,
      lesson_id: message.lessonId,
      platform: null,
      stage: "run_step",
      status: message.status,
      step: message.step,
    });
  }

  if (last) {
    await stream.close();
  }
}
