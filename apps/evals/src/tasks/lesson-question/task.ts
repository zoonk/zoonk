import { type Task } from "@/lib/types";
import {
  type GenerateLessonQuestionAnswerParams,
  type LessonQuestionAnswerSchema,
  generateLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import { TEST_CASES } from "./test-cases";

export const lessonQuestionTask: Task<
  GenerateLessonQuestionAnswerParams,
  LessonQuestionAnswerSchema
> = {
  description: "Answer learner questions using lesson, step, and validated answer context",
  generate: generateLessonQuestionAnswer,
  id: "lesson-question",
  name: "Lesson Question",
  testCases: TEST_CASES,
};
