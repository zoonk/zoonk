import { type Task } from "@/lib/types";
import {
  type ActivityGrammarParams,
  type ActivityGrammarSchema,
  generateActivityGrammar,
} from "@zoonk/ai/tasks/activities/language/grammar";
import { TEST_CASES } from "./test-cases";

export const activityGrammarTask: Task<ActivityGrammarParams, ActivityGrammarSchema> = {
  description: "Generate Pattern Discovery grammar activities for language learning lessons",
  generate: generateActivityGrammar,
  id: "activity-grammar",
  name: "Activity Grammar",
  testCases: TEST_CASES,
};
