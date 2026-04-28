import { type Task } from "@/lib/types";
import {
  type LessonDistractorsParams,
  type LessonDistractorsSchema,
  generateLessonDistractors,
} from "@zoonk/ai/tasks/lessons/language/distractors";
import { TEST_CASES } from "./test-cases";

export const lessonDistractorsTask: Task<LessonDistractorsParams, LessonDistractorsSchema> = {
  description: "Generate direct distractor words for translation, reading, and listening lessons",
  generate: generateLessonDistractors,
  id: "lesson-distractors",
  name: "Lesson Distractors",
  testCases: TEST_CASES,
};
