import { type Task } from "@/lib/types";
import {
  type TranslationParams,
  type TranslationSchema,
  generateTranslation,
} from "@zoonk/ai/tasks/activities/language/translation";
import { TEST_CASES } from "./test-cases";

export const activityTranslationTask: Task<TranslationParams, TranslationSchema> = {
  description: "Translate individual words for language learners",
  generate: generateTranslation,
  id: "activity-translation",
  name: "Activity Translation",
  testCases: TEST_CASES,
};
