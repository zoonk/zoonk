import { type Task, toModelCall } from "@/lib/types";
import { type BilledCall, meterBilledCalls } from "@zoonk/ai/billed-calls";
import { MEMORY_TEST_CASES } from "./memory-test-cases";
import { type LiveConversationInput, runLiveCall } from "./run-call";
import { LIVE_CONVERSATION_SCORE_CATEGORIES } from "./score-categories";
import {
  type LiveConversationExpected,
  type LiveConversationOutput,
  scoreLiveConversation,
} from "./scorer";
import { TEST_CASES } from "./test-cases";

export const liveConversationTask: Task<
  LiveConversationInput,
  LiveConversationOutput,
  LiveConversationExpected
> = {
  description:
    "Play a practice call's character on GPT-Live with the production instructions and cues, against a text model playing the learner through the app's typed replies, with objectives marked by the production check: code checks the opening, objectives, reply length, that the character waits while the learner writes and that a learner's note is never quoted, then a judge reads the call for role, level, objectives and how the character used the note",
  generate: async ({ call, learner }) => {
    // The run's cost is GPT-Live's seconds; the learner's lines and objective checks are spent too.
    const textCalls: BilledCall[] = [];

    const { instructions, learnerPrompt, seconds, turns } = await meterBilledCalls(textCalls, () =>
      runLiveCall({ call, learner }),
    );

    return {
      data: { seconds, turns },
      extraCalls: textCalls.map((textCall) => toModelCall(textCall)),
      systemPrompt: instructions,
      usage: { audioSeconds: seconds, inputTokens: 0, outputTokens: 0 },
      userPrompt: learnerPrompt,
    };
  },
  id: "live-conversation",
  name: "Live Conversation",
  output: "realtime",
  score: scoreLiveConversation,
  scoreCategories: LIVE_CONVERSATION_SCORE_CATEGORIES,
  testCases: [...TEST_CASES, ...MEMORY_TEST_CASES],
};
