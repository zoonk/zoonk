import {
  type ConversationReviewInput,
  type ConversationReviewOutcome,
} from "@zoonk/core/language/conversations/review";
import { getWorkflowMetadata } from "workflow";
import {
  claimReviewStep,
  endReviewedCallStep,
  reviewCallStep,
  settleReviewStep,
} from "./steps/conversation-review-steps";

/**
 * Finishes a completed call once: claims its review (a replay of this run keeps its claim), hangs
 * the call up, reviews the transcript (kept on the call, so a retried or new settle doesn't grade
 * it again) and settles the call. A review that keeps failing settles the call without feedback,
 * with the goals marked during it.
 */
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
  const review = await reviewCallStep({ ...input, runId }).catch(() => null);

  return settleReviewStep({ ...input, review, runId });
}
