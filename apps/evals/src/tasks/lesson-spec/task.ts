import { type Task } from "@/lib/types";
import { type LessonSpecParams, generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { scoreLessonSpec } from "./scorer";
import { TEST_CASES } from "./test-cases";
import { type LessonSpecExpected } from "./visual-test-cases";

type LessonSpecOutput = Awaited<ReturnType<typeof generateLessonSpec>>["data"];

export const lessonSpecTask: Task<LessonSpecParams, LessonSpecOutput, LessonSpecExpected> = {
  description:
    "Plan a lesson before it's written: 1 to 3 skills, a 5 to 12 screen plan with checks, activities, visuals and support mode, split when it doesn't fit",
  generate: generateLessonSpec,
  id: "lesson-spec",
  name: "Lesson Spec",
  score: scoreLessonSpec,
  testCases: TEST_CASES,
};
