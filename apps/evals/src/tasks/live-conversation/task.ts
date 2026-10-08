import { type Task } from "@/lib/types";
import { buildLiveConversationInstructions } from "@zoonk/ai/tasks/v2/language/live-conversation-instructions";
import { isLiveCallModel, runScriptedLiveCall } from "./live-call";
import { LIVE_CONVERSATION_SCORE_CATEGORIES } from "./score-categories";
import { type LiveConversationOutput, scoreLiveConversation } from "./scorer";
import {
  type LiveConversationExpected,
  type LiveConversationInput,
  TEST_CASES,
} from "./test-cases";

/**
 * The live conversation itself: a voice model (GPT-Live, or Gemini Live to compare) plays the
 * unit's character (or the exam's examiner) with the production instructions against a scripted
 * learner whose lines are spoken by text-to-speech, and the production objective check marks goals
 * after each learner turn. Output is the transcript with the objectives marked after each learner
 * turn, and the call's session length and cost.
 */
export const liveConversationTask: Task<
  LiveConversationInput,
  LiveConversationOutput,
  LiveConversationExpected
> = {
  description:
    "Play a live conversation's character on a voice model against a scripted learner speaking through text-to-speech, with objectives marked from the transcript: code checks the opening, objectives and reply length, then a judge reads the call",
  generate: async ({ call, learnerTurns, model }) => {
    if (!isLiveCallModel(model)) {
      throw new Error(`${model} isn't a live conversation model.`);
    }

    const instructions = buildLiveConversationInstructions(call);

    const { turns, usage } = await runScriptedLiveCall({
      instructions,
      learnerLanguage: call.learnerLanguage,
      learnerTurns,
      model,
      scenario: call.scenario,
      targetLanguage: call.targetLanguage,
    });

    return {
      data: { turns, usage },
      systemPrompt: instructions,
      usage: { inputTokens: 0, outputTokens: 0 },
      userPrompt: learnerTurns.join("\n"),
    };
  },
  id: "live-conversation",
  name: "Live Conversation",
  output: "realtime",
  score: scoreLiveConversation,
  scoreCategories: LIVE_CONVERSATION_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
