import { type Task } from "@/lib/types";
import {
  type WordAlternativeTranslationsParams,
  type WordAlternativeTranslationsSchema,
  generateWordAlternativeTranslations,
} from "@zoonk/ai/tasks/activities/language/word-alternative-translations";
import { TEST_CASES } from "./test-cases";

export const wordAlternativeTranslationsTask: Task<
  WordAlternativeTranslationsParams,
  WordAlternativeTranslationsSchema
> = {
  description:
    "Generate alternative translations for vocabulary words to prevent false negatives in exercises",
  generate: generateWordAlternativeTranslations,
  id: "word-alternative-translations",
  name: "Word Alternative Translations",
  testCases: TEST_CASES,
};
