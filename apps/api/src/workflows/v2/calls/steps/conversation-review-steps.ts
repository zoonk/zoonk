import { claimConversationReview } from "@zoonk/core/language/conversations/claim-review";
import { endLiveCall } from "@zoonk/core/language/conversations/end-live-call";
import {
  type ConversationReview,
  type ConversationReviewInput,
  reviewConversationCall,
  settleConversationReview,
} from "@zoonk/core/language/conversations/review";
import { safeAsync } from "@zoonk/utils/error";

export async function claimReviewStep(input: ConversationReviewInput & { runId: string }) {
  "use step";
  return claimConversationReview(input);
}

/** Feedback doesn't depend on the hangup: one that fails is left to the deadline run. */
export async function endReviewedCallStep(connectionId: string) {
  "use step";
  await safeAsync(() => endLiveCall({ connectionId, reason: "completion" }));
}

/** A model failure throws, so the step's retries try again before the call ends without feedback. */
export async function reviewCallStep(input: ConversationReviewInput & { runId: string }) {
  "use step";
  return reviewConversationCall(input);
}

export async function settleReviewStep(
  input: ConversationReviewInput & { review: ConversationReview | null; runId: string },
) {
  "use step";
  return settleConversationReview(input);
}
