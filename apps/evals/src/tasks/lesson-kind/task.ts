import {
  generateLessonKind,
  type LessonKindParams,
  type LessonKindSchema,
} from "@zoonk/ai/tasks/lessons/kind";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const lessonKindTask: Task<LessonKindParams, LessonKindSchema> = {
  description: "Classify lessons into appropriate kinds (core, language, custom)",
  generate: generateLessonKind,
  id: "lesson-kind",
  name: "Lesson Kind",
  testCases: TEST_CASES,
};
