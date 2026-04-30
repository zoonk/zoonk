import { type Task } from "@/lib/types";
import {
  type LessonExplanationParams,
  type LessonExplanationSchema,
  generateLessonExplanation,
} from "@zoonk/ai/tasks/lessons/core/explanation";
import { TEST_CASES } from "./test-cases";

export const lessonExplanationTask: Task<LessonExplanationParams, LessonExplanationSchema> = {
  description:
    "Generate a structured explanation lesson with a hook, daily-life scenario, concept steps, and a concrete anchor",
  generate: generateLessonExplanation,
  id: "lesson-explanation",
  name: "Lesson Explanation",
  testCases: TEST_CASES,
};
