import { type Task } from "@/lib/types";
import {
  type LessonAlphabetParams,
  type LessonAlphabetSchema,
  generateLessonAlphabet,
} from "@zoonk/ai/tasks/lessons/language/alphabet";
import { TEST_CASES } from "./test-cases";

export const lessonAlphabetTask: Task<LessonAlphabetParams, LessonAlphabetSchema> = {
  description: "Generate focused alphabet lesson intro and symbol cards",
  generate: generateLessonAlphabet,
  id: "lesson-alphabet",
  name: "Lesson Alphabet",
  testCases: TEST_CASES,
};
