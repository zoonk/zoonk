import { type Task } from "@/lib/types";
import {
  type ActivityVocabularyParams,
  type ActivityVocabularySchema,
  generateActivityVocabulary,
} from "@zoonk/ai/tasks/activities/language/vocabulary";
import { TEST_CASES } from "./test-cases";

export const activityVocabularyTask: Task<ActivityVocabularyParams, ActivityVocabularySchema> = {
  description: "Generate vocabulary quiz questions for language learning lessons",
  generate: generateActivityVocabulary,
  id: "activity-vocabulary",
  name: "Activity Vocabulary",
  testCases: TEST_CASES,
};
