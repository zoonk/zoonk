import { type Task } from "@/lib/types";
import {
  type WordDistractorUnsafeTranslationsParams,
  type WordDistractorUnsafeTranslationsSchema,
  generateWordDistractorUnsafeTranslations,
} from "@zoonk/ai/tasks/activities/language/word-distractor-unsafe-translations";
import { TEST_CASES } from "./test-cases";

export const wordDistractorUnsafeTranslationsTask: Task<
  WordDistractorUnsafeTranslationsParams,
  WordDistractorUnsafeTranslationsSchema
> = {
  description:
    "Generate distractor-unsafe translations for vocabulary words so exercises avoid misleading distractors",
  generate: generateWordDistractorUnsafeTranslations,
  id: "word-distractor-unsafe-translations",
  name: "Word Distractor Safety",
  testCases: TEST_CASES,
};
