import { type TestCase } from "@/lib/types";
import { type CheckLessonQualityParams } from "@zoonk/ai/tasks/quality/lesson-check";
import fixtures from "./real-lessons.json";
import { type LessonQualityCheckExpected } from "./test-cases";

export type RealReviewInput = {
  recorded: Pick<CheckLessonQualityParams, "lesson"> & {
    context: Omit<CheckLessonQualityParams, "lesson" | "writerModel">;
  };
};

/** Real-7: screen 2 gives 45 of the 60 new places to high income; the hook, screen 11 and its chart give all 60. */
const EXPECTED: LessonQualityCheckExpected[] = [
  { screen: 8, verdict: "fail" },
  { screen: 7, verdict: "fail" },
  { screen: null, verdict: "fail" },
  { screen: 14, verdict: "fail" },
  { screen: 3, verdict: "fail" },
  { verdict: "pass" },
  { screen: 2, verdict: "fail" },
];

export const REAL_REVIEW_CASES: TestCase<LessonQualityCheckExpected, RealReviewInput>[] =
  fixtures.map((recorded, index) => ({
    expected: EXPECTED[index],
    id: `real-${index + 1}`,
    language: "pt",
    origin: "production",
    userInput: { recorded: recorded as RealReviewInput["recorded"] },
  }));
