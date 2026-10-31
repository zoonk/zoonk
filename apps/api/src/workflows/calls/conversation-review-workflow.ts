import {
  type ConversationReview,
  type ConversationReviewInput,
  type ConversationReviewOutcome,
} from "@zoonk/core/language/conversations/review";
import { getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { speakingMockWorkflow } from "./speaking-mock-workflow";
import {
  checkObjectivesStep,
  claimReviewStep,
  endReviewedCallStep,
  findNextSpeakingMockStep,
  scoreCallStep,
  settleReviewStep,
  writeReviewStep,
} from "./steps/conversation-review-steps";

/**
 * One model call per step: an exam's score runs alongside the objective check, and a practice
 * call's feedback, which says which objectives were met, after it. A failed step retries alone.
 */
async function reviewCall(
  input: ConversationReviewInput & { runId: string },
): Promise<ConversationReview | null> {
  const [objectivesMet, score] = await Promise.all([
    checkObjectivesStep(input),
    scoreCallStep(input),
  ]);

  return objectivesMet && score ? writeReviewStep({ ...input, objectivesMet, score }) : null;
}

/** Decided from the settled call, so a replay after the settle still writes the next mock. */
async function writeNextSpeakingMock({ conversationId, userId }: ConversationReviewInput) {
  const goalId = await findNextSpeakingMockStep({ conversationId, userId });

  if (goalId) {
    await start(speakingMockWorkflow, [{ goalId, userId }]);
  }
}

export async function conversationReviewWorkflow(
  input: ConversationReviewInput,
): Promise<ConversationReviewOutcome> {
  "use workflow";

  const { workflowRunId: runId } = getWorkflowMetadata();
  const claim = await claimReviewStep({ ...input, runId });

  if (claim.status === "settled") {
    return { progress: null, status: "completed", won: false };
  }

  if (claim.status !== "owner") {
    return claim;
  }

  await endReviewedCallStep(input.connectionId);
  const review = await reviewCall({ ...input, runId }).catch(() => null);
  const outcome = await settleReviewStep({ ...input, review, runId });

  await writeNextSpeakingMock(input).catch(() => null);

  return outcome;
}
