import { type Task } from "@/lib/types";
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
    "Play a practice call's character on GPT-Live with the production instructions and cues, against a text model playing the learner through the app's typed replies, with objectives marked by the production check: code checks the opening, objectives, reply length and that a learner's note is never quoted, then a judge reads the call for role, level, objectives and how the character used the note",
  generate: async ({ call, learner }) => {
    const { extraCalls, instructions, learnerPrompt, seconds, turns } = await runLiveCall({
      call,
      learner,
    });

    return {
      data: { seconds, turns },
      extraCalls,
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
