import {
  type ActivitySentencesParams,
  type ActivitySentencesSchema,
  generateActivitySentences,
} from "@zoonk/ai/tasks/activities/language/sentences";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activitySentencesTask: Task<
  ActivitySentencesParams,
  ActivitySentencesSchema
> = {
  description:
    "Generate practice sentences using vocabulary words for language learning",
  generate: generateActivitySentences,
  id: "activity-sentences",
  name: "Activity Sentences",
  testCases: TEST_CASES,
};
