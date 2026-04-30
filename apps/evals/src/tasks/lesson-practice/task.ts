import { type Task } from "@/lib/types";
import {
  type LessonPracticeParams,
  type LessonPracticeSchema,
  generateLessonPractice,
} from "@zoonk/ai/tasks/lessons/core/practice";
import { TEST_CASES } from "./test-cases";

export const lessonPracticeTask: Task<LessonPracticeParams, LessonPracticeSchema> = {
  description:
    "Generate a visual-first practice lesson where learners solve real problems with a colleague",
  generate: generateLessonPractice,
  id: "lesson-practice",
  name: "Lesson Practice",
  testCases: TEST_CASES,
};
