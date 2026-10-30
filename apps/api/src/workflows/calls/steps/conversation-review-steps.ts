import { claimConversationReview } from "@zoonk/core/language/conversations/claim-review";
import { endLiveCall } from "@zoonk/core/language/conversations/end-live-call";
import {
  type ConversationReview,
  type ConversationReviewInput,
  reviewConversationCall,
  settleConversationReview,
} from "@zoonk/core/language/conversations/review";
import { isBlockedTestCall } from "@zoonk/utils/blocked-test-call";
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

export async function reviewCallStep(input: ConversationReviewInput & { runId: string }) {
  "use step";
  const { data, error } = await safeAsync(() => reviewConversationCall(input));

  if (error && !isBlockedTestCall(error)) {
    throw error;
  }

  return data;
}

export async function settleReviewStep(
  input: ConversationReviewInput & { review: ConversationReview | null; runId: string },
) {
  "use step";
  return settleConversationReview(input);
}
