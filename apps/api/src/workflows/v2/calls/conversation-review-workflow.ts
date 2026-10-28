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
