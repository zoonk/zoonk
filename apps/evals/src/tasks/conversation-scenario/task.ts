import { type Task } from "@/lib/types";
import {
  type GenerateConversationScenarioParams,
  type GenerateConversationScenarioSchema,
  generateConversationScenario,
} from "@zoonk/ai/tasks/language/conversation-scenario";
import { CONVERSATION_SCENARIO_SCORE_CATEGORIES } from "./score-categories";
import { type ConversationScenarioExpected, scoreConversationScenario } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const conversationScenarioTask: Task<
  GenerateConversationScenarioParams,
  GenerateConversationScenarioSchema,
  ConversationScenarioExpected
> = {
  description:
    "Write a unit's role-play call at one level: goal, character, opening line, objectives, hints and a private brief for the voice model",
  generate: generateConversationScenario,
  id: "conversation-scenario",
  name: "Conversation Scenario",
  score: scoreConversationScenario,
  scoreCategories: CONVERSATION_SCENARIO_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
