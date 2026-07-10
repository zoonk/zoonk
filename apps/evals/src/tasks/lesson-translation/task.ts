import { type Task } from "@/lib/types";
import {
  type TranslationParams,
  type TranslationSchema,
  generateTranslation,
} from "@zoonk/ai/tasks/lessons/language/translation";
import { type LessonTranslationExpected, scoreLessonTranslation } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const lessonTranslationTask: Task<
  TranslationParams,
  TranslationSchema,
  LessonTranslationExpected
> = {
  description: "Translate individual words for language learners",
  generate: generateTranslation,
  id: "lesson-translation",
  name: "Lesson Translation",
  score: scoreLessonTranslation,
  testCases: TEST_CASES,
};
