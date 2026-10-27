import { randomUUID } from "node:crypto";
import { claimConversationReview } from "../language/conversations/claim-conversation-review";
import { type ConversationReviewRuns } from "../language/conversations/complete-language-conversation";
import {
  type ConversationReviewInput,
  type ConversationReviewOutcome,
  reviewConversationCall,
  settleConversationReview,
} from "../language/conversations/conversation-review";
import { endLiveCall } from "../language/conversations/end-live-call";

const runs = new Map<string, Promise<ConversationReviewOutcome>>();

/** The API's review workflow, its steps run in order in this process (without step retries). */
async function runReview(
  input: ConversationReviewInput,
  runId: string,
): Promise<ConversationReviewOutcome> {
  const claim = await claimConversationReview({ ...input, runId });

  if (claim.status === "settled") {
    return { progress: null, status: "completed", won: false };
  }

  if (claim.status !== "owner") {
    return claim;
  }

  await endLiveCall({ connectionId: input.connectionId, reason: "completion" }).catch(() => null);
  const review = await reviewConversationCall({ ...input, runId }).catch(() => null);

  return settleConversationReview({ ...input, review, runId });
}

/** Review runs for core tests: the Workflow runtime lives in the API, whose own tests run it. */
export const reviewRunsInline: ConversationReviewRuns = {
  failed: async (runId) => {
    const run = runs.get(runId);

    return run
      ? run.then(
          () => false,
          () => true,
        )
      : false;
  },
  outcome: (runId) => runs.get(runId) ?? Promise.reject(new Error(`No review run ${runId}`)),
  start: async (input) => {
    const runId = `wrun_${randomUUID()}`;
    const run = runReview(input, runId);
    // Its failure reaches whoever waits for its outcome.
    run.catch(() => null);
    runs.set(runId, run);
    return runId;
  },
};
