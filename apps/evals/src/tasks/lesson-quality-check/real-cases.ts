import { type TestCase } from "@/lib/types";
import { type CheckLessonQualityParams } from "@zoonk/ai/tasks/quality/lesson-check";
import fixtures from "./real-lessons.json";
import { type LessonQualityCheckExpected } from "./test-cases";

export type RealReviewInput = {
  recorded: Pick<CheckLessonQualityParams, "lesson"> & {
    context: Omit<CheckLessonQualityParams, "lesson" | "writerModel">;
  };
};
const screens = [8, 7, null, 14, 3, null];
export const REAL_REVIEW_CASES: TestCase<LessonQualityCheckExpected, RealReviewInput>[] =
  fixtures.map((recorded, index) => ({
    expected:
      index === 5 ? { verdict: "pass" } : { screen: screens[index] ?? null, verdict: "fail" },
    id: `real-${index + 1}`,
    language: "pt",
    origin: "production",
    userInput: { recorded: recorded as RealReviewInput["recorded"] },
  }));
