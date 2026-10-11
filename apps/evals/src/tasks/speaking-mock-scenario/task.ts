import { type Task } from "@/lib/types";
import { type GenerateConversationScenarioSchema } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import {
  type GenerateSpeakingMockScenarioParams,
  generateSpeakingMockScenario,
} from "@zoonk/ai/tasks/v2/language/speaking-mock-scenario";
import { SPEAKING_MOCK_SCENARIO_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const speakingMockScenarioTask: Task<
  GenerateSpeakingMockScenarioParams,
  GenerateConversationScenarioSchema
> = {
  description:
    "Write one practice mock of an exam's speaking test: the examiner, their script with the exam's parts, the opening line, objectives and hints",
  generate: generateSpeakingMockScenario,
  id: "speaking-mock-scenario",
  name: "Speaking Mock Scenario",
  scoreCategories: SPEAKING_MOCK_SCENARIO_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
