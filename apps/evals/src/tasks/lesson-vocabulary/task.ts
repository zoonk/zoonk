import { type Task } from "@/lib/types";
import {
  type LessonVocabularyParams,
  type LessonVocabularySchema,
  generateLessonVocabulary,
} from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { TEST_CASES } from "./test-cases";

export const lessonVocabularyTask: Task<LessonVocabularyParams, LessonVocabularySchema> = {
  description: "Generate vocabulary quiz questions for language learning lessons",
  generate: generateLessonVocabulary,
  id: "lesson-vocabulary",
  name: "Lesson Vocabulary",
  testCases: TEST_CASES,
};
