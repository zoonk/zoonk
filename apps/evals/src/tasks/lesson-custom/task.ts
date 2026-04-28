import { type Task } from "@/lib/types";
import {
  type LessonCustomParams,
  type LessonCustomSchema,
  generateLessonCustom,
} from "@zoonk/ai/tasks/lessons/custom";
import { TEST_CASES } from "./test-cases";

export const lessonCustomTask: Task<LessonCustomParams, LessonCustomSchema> = {
  description: "Generate procedural steps for a custom lesson",
  generate: generateLessonCustom,
  id: "lesson-custom",
  name: "Lesson Custom",
  testCases: TEST_CASES,
};
