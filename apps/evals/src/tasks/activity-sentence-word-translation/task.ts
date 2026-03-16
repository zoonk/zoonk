import { type Task } from "@/lib/types";
import {
  type SentenceWordTranslationParams,
  type SentenceWordTranslationSchema,
  generateSentenceWordTranslation,
} from "@zoonk/ai/tasks/activities/language/sentence-word-translation";
import { TEST_CASES } from "./test-cases";

export const activitySentenceWordTranslationTask: Task<
  SentenceWordTranslationParams,
  SentenceWordTranslationSchema
> = {
  description: "Translate individual sentence words and provide romanization for language learners",
  generate: generateSentenceWordTranslation,
  id: "activity-sentence-word-translation",
  name: "Activity Sentence Word Translation",
  testCases: TEST_CASES,
};
