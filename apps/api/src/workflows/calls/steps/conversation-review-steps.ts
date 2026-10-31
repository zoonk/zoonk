import { claimConversationReview } from "@zoonk/core/language/conversations/claim-review";
import { endLiveCall } from "@zoonk/core/language/conversations/end-live-call";
import {
  findNextSpeakingMockGoalId,
  prepareSpeakingMock,
} from "@zoonk/core/language/conversations/prepare";
import {
  type ConversationReview,
  type ConversationReviewInput,
  checkConversationCallObjectives,
  scoreConversationCall,
  settleConversationReview,
  writeConversationCallReview,
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

/** The test kill switch stops a review at once, so the call settles without one. */
async function unlessBlocked<T>(review: () => Promise<T>): Promise<T | null> {
  const { data, error } = await safeAsync(review);

  if (error && !isBlockedTestCall(error)) {
    throw error;
  }

  return data;
}

export async function checkObjectivesStep(input: ConversationReviewInput) {
  "use step";
  return unlessBlocked(() => checkConversationCallObjectives(input));
}

export async function scoreCallStep(input: ConversationReviewInput) {
  "use step";
  return unlessBlocked(() => scoreConversationCall(input));
}

export async function writeReviewStep(
  input: ConversationReviewInput & Parameters<typeof writeConversationCallReview>[0],
) {
  "use step";
  return unlessBlocked(() => writeConversationCallReview(input));
}

export async function settleReviewStep(
  input: ConversationReviewInput & { review: ConversationReview | null; runId: string },
) {
  "use step";
  return settleConversationReview(input);
}

export async function findNextSpeakingMockStep(input: { conversationId: string; userId: string }) {
  "use step";
  return findNextSpeakingMockGoalId(input);
}

export async function prepareSpeakingMockStep(input: { goalId: string; userId: string }) {
  "use step";
  await prepareSpeakingMock(input);
}
