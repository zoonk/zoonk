import { conversationReviewWorkflow } from "@/workflows/v2/calls/conversation-review-workflow";
import { type ConversationReviewRuns } from "@zoonk/core/language/conversations/complete";
import { getRun, start } from "workflow/api";

/** A run that ended without an outcome; its claim may be replaced. */
const FAILED = new Set(["failed", "cancelled"]);

/** Core's completion reviews each call in a durable Workflow run. */
export const conversationReviewRuns: ConversationReviewRuns = {
  failed: async (runId) => FAILED.has(await getRun(runId).status),
  outcome: (runId) =>
    getRun<Awaited<ReturnType<typeof conversationReviewWorkflow>>>(runId).returnValue,
  start: async (input) => {
    const run = await start(conversationReviewWorkflow, [input]);
    return run.runId;
  },
};
