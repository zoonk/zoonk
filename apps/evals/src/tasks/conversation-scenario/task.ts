import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import {
  type GenerateConversationScenarioParams,
  type GenerateConversationScenarioSchema,
  generateConversationScenario,
} from "@zoonk/ai/tasks/language/conversation-scenario";
import { readCriteria } from "../plain-language-criterion";
import { CONVERSATION_SCENARIO_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const conversationScenarioTask: Task<
  GenerateConversationScenarioParams,
  GenerateConversationScenarioSchema
> = {
  criteria: readCriteria(CONVERSATION_SCENARIO_SCORE_CATEGORIES),
  description:
    "Write a unit's role-play call at one level: goal, character, opening line, objectives, hints and a private brief for the voice model",
  generate: generateConversationScenario,
  id: "conversation-scenario",
  name: "Conversation scenario",
  priorities: {
    comparison: {
      criteria: {
        brief: "counts",
        languages: "counts",
        level: "counts",
        objectives: "counts",
        unitFit: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.shared,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner reads the scenario; a voice model plays the character",
    reason: "Cached per chapter and level and reused by every learner of the unit",
    waits: "Prepared ahead in a workflow; a request writes it when missing",
  },
  scoreCategories: CONVERSATION_SCENARIO_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
