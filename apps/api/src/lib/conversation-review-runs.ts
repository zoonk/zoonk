import { conversationReviewWorkflow } from "@/workflows/v2/calls/conversation-review-workflow";
import { type ConversationReviewRuns } from "@zoonk/core/language/conversations/complete";
import { getRun, start } from "workflow/api";

const FAILED = new Set(["failed", "cancelled"]);

export const conversationReviewRuns: ConversationReviewRuns = {
  failed: async (runId) => FAILED.has(await getRun(runId).status),
  outcome: (runId) =>
    getRun<Awaited<ReturnType<typeof conversationReviewWorkflow>>>(runId).returnValue,
  start: async (input) => {
    const run = await start(conversationReviewWorkflow, [input]);
    return run.runId;
  },
};
