import { type Task } from "@/lib/types";
import {
  type LessonQuizParams,
  type LessonQuizSchema,
  generateLessonQuiz,
} from "@zoonk/ai/tasks/lessons/core/quiz";
import { TEST_CASES } from "./test-cases";

export const lessonQuizTask: Task<LessonQuizParams, LessonQuizSchema> = {
  description: "Generate quiz questions that test understanding of one source lesson",
  generate: generateLessonQuiz,
  id: "lesson-quiz",
  name: "Lesson Quiz",
  testCases: TEST_CASES,
};
