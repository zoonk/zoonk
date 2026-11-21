import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import { meterAsExtra } from "@zoonk/ai/billed-calls";
import { readCriteria } from "../plain-language-criterion";
import { MEMORY_TEST_CASES } from "./memory-test-cases";
import { type LiveConversationInput, runLiveCall } from "./run-call";
import {
  LIVE_CONVERSATION_SCORE_CATEGORIES,
  MEMORY_CALL_SCORE_CATEGORIES,
} from "./score-categories";
import {
  type LiveConversationExpected,
  type LiveConversationOutput,
  checkLiveConversationOutput,
  scoreLiveConversation,
} from "./scorer";
import { TEST_CASES } from "./test-cases";

export const liveConversationTask: Task<
  LiveConversationInput,
  LiveConversationOutput,
  LiveConversationExpected
> = {
  codeChecks: checkLiveConversationOutput,
  criteria: readCriteria(MEMORY_CALL_SCORE_CATEGORIES),
  description:
    "Play a practice call's character on GPT-Live with the production instructions and cues, against a text model playing the learner through the app's typed replies, with objectives marked by the production check: code checks the opening, objectives, reply length, that the character waits while the learner writes and that a learner's note is never quoted, then a judge reads the call for role, level, objectives and how the character used the note",
  generate: async ({ call, learner }) => {
    // The run's cost is GPT-Live's seconds; the learner's lines and objective checks are spent too.
    const { instructions, learnerPrompt, seconds, turns } = await meterAsExtra(() =>
      runLiveCall({ call, learner }),
    );

    return {
      data: { seconds, turns },
      systemPrompt: instructions,
      usage: { audioSeconds: seconds, inputTokens: 0, outputTokens: 0 },
      userPrompt: learnerPrompt,
    };
  },
  id: "live-conversation",
  name: "Live conversation",
  output: "realtime",
  priorities: {
    comparison: {
      criteria: { level: "counts", memory: "counts", objectives: "counts", role: "counts" },
      preference: "separates",
      trade: COMPARISON_TRADES.private,
    },
    distribution: "private",
    first: "latency",
    reads: "A learner hears the character in a live call",
    reason: "A real-time voice call; only one provider serves it today",
    waits: "A learner is live in the call",
  },
  score: scoreLiveConversation,
  scoreCategories: LIVE_CONVERSATION_SCORE_CATEGORIES,
  testCases: [...TEST_CASES, ...MEMORY_TEST_CASES],
};
