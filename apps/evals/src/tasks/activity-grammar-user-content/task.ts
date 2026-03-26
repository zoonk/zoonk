import { type Task } from "@/lib/types";
import {
  type ActivityGrammarUserContentParams,
  type ActivityGrammarUserContentSchema,
  generateActivityGrammarUserContent,
} from "@zoonk/ai/tasks/activities/language/grammar-user-content";
import { TEST_CASES } from "./test-cases";

export const activityGrammarUserContentTask: Task<
  ActivityGrammarUserContentParams,
  ActivityGrammarUserContentSchema
> = {
  description:
    "Generate user-language content (translations, discovery question, rule summary, feedback) for grammar activities",
  generate: generateActivityGrammarUserContent,
  id: "activity-grammar-user-content",
  name: "Activity Grammar User Content",
  testCases: TEST_CASES,
};
