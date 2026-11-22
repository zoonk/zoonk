import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import { type GenerateConversationScenarioSchema } from "@zoonk/ai/tasks/language/conversation-scenario";
import {
  type GenerateSpeakingMockScenarioParams,
  generateSpeakingMockScenario,
} from "@zoonk/ai/tasks/language/speaking-mock-scenario";
import { readCriteria } from "../plain-language-criterion";
import { SPEAKING_MOCK_SCENARIO_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const speakingMockScenarioTask: Task<
  GenerateSpeakingMockScenarioParams,
  GenerateConversationScenarioSchema
> = {
  criteria: readCriteria(SPEAKING_MOCK_SCENARIO_SCORE_CATEGORIES),
  description:
    "Write one practice mock of an exam's speaking test: the examiner, their script with the exam's parts, the opening line, objectives and hints",
  generate: generateSpeakingMockScenario,
  id: "speaking-mock-scenario",
  name: "Speaking mock scenario",
  priorities: {
    comparison: {
      criteria: {
        brief: "counts",
        examFit: "counts",
        languages: "counts",
        level: "counts",
        objectives: "counts",
      },
      preference: "separates",
      trade: { ...COMPARISON_TRADES.private, saveSeconds: null },
    },
    distribution: "private",
    first: "cost",
    reads: "A learner reads the mock; a voice model plays the examiner",
    reason: "Personal and usually written ahead: the cheapest model that scored well",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  scoreCategories: SPEAKING_MOCK_SCENARIO_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
