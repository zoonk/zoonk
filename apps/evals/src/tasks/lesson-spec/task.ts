import { type OptionalCountry, type Task } from "@/lib/types";
import { type LessonSpecParams, generateLessonSpec } from "@zoonk/ai/tasks/lesson-spec";
import { LESSON_SPEC_SCORE_CATEGORIES } from "./score-categories";
import { checkLessonSpecOutput, scoreLessonSpec } from "./scorer";
import { TEST_CASES } from "./test-cases";
import { type LessonSpecExpected } from "./visual-test-cases";

type LessonSpecOutput = Awaited<ReturnType<typeof generateLessonSpec>>["data"];

export const lessonSpecTask: Task<
  OptionalCountry<LessonSpecParams>,
  LessonSpecOutput,
  LessonSpecExpected
> = {
  codeChecks: checkLessonSpecOutput,
  description:
    "Plan a lesson before it's written: 1 to 3 skills, a 5 to 16 screen plan with checks, activities and visuals, split when it doesn't fit",
  generate: (input) => generateLessonSpec({ ...input, country: input.country ?? null }),
  id: "lesson-spec",
  name: "Lesson Spec",
  score: scoreLessonSpec,
  scoreCategories: LESSON_SPEC_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
