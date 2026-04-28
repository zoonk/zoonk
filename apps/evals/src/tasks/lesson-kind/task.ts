import { type Task } from "@/lib/types";
import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { TEST_CASES } from "./test-cases";

export const lessonKindTask: Task<
  Parameters<typeof generateLessonKind>[0],
  Awaited<ReturnType<typeof generateLessonKind>>["data"]
> = {
  description: "Classifies one lesson as explanation or tutorial",
  generate: generateLessonKind,
  id: "lesson-kind",
  name: "Lesson Kind",
  testCases: TEST_CASES,
};
