import { type Task } from "@/lib/types";
import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { type LessonKindExpected, scoreLessonKind } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const lessonKindTask: Task<
  Parameters<typeof generateLessonKind>[0],
  Awaited<ReturnType<typeof generateLessonKind>>["data"],
  LessonKindExpected
> = {
  description: "Classifies one lesson as explanation or tutorial",
  generate: generateLessonKind,
  id: "lesson-kind",
  name: "Lesson Kind",
  score: scoreLessonKind,
  testCases: TEST_CASES,
};
