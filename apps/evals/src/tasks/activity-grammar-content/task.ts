import { type Task } from "@/lib/types";
import {
  type ActivityGrammarContentParams,
  type ActivityGrammarContentSchema,
  generateActivityGrammarContent,
} from "@zoonk/ai/tasks/activities/language/grammar-content";
import { TEST_CASES } from "./test-cases";

export const activityGrammarContentTask: Task<
  ActivityGrammarContentParams,
  ActivityGrammarContentSchema
> = {
  description:
    "Generate monolingual grammar content (examples + exercises) in the target language only",
  generate: generateActivityGrammarContent,
  id: "activity-grammar-content",
  name: "Activity Grammar Content",
  testCases: TEST_CASES,
};
