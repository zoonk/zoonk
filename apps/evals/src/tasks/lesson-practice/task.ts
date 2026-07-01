import { type Task } from "@/lib/types";
import {
  type LessonPracticeParams,
  type LessonPracticeSchema,
  generateLessonPractice,
} from "@zoonk/ai/tasks/lessons/core/practice";
import { TEST_CASES } from "./test-cases";

export const lessonPracticeTask: Task<LessonPracticeParams, LessonPracticeSchema> = {
  description:
    "Generate visual-first practice situations where learners apply source lesson concepts to real-life problems",
  generate: generateLessonPractice,
  id: "lesson-practice",
  name: "Lesson Practice",
  testCases: TEST_CASES,
};
