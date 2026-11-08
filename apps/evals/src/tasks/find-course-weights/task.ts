import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type CourseWeightsFinding,
  type FindCourseWeightsParams,
  findCourseWeights,
} from "@zoonk/ai/tasks/research/find-course-weights";
import { TEST_CASES } from "./test-cases";

/** The published weights in `SUBJECTS` order; a source's scale may differ (1, 2 or 10, 20). */
export type FindCourseWeightsExpected =
  | { status: "found"; weights: number[] }
  | { status: "unknown" };

function parseOutput(output: string): CourseWeightsFinding | null {
  try {
    return JSON.parse(output) as CourseWeightsFinding;
  } catch {
    return null;
  }
}

function isSameWeighting({
  expected,
  found,
}: {
  expected: readonly number[];
  found: readonly number[];
}): boolean {
  const scale = (found[0] ?? 0) / (expected[0] ?? 1);

  return (
    found.length === expected.length &&
    expected.every((weight, index) => Math.abs((found[index] ?? 0) - weight * scale) < 1e-6)
  );
}

const scoreCourseWeights: TaskScorer<FindCourseWeightsExpected> = ({ output, testCase }) => {
  const found = parseOutput(output);
  const expected = testCase.expected;

  if (!found || !expected) {
    return createFixedScore({ conclusion: "No output", score: 6 });
  }

  if (found.status !== "found") {
    return expected.status === "found"
      ? createFixedScore({ conclusion: "Missed the published weights", score: 8 })
      : createFixedScore({ conclusion: "None", score: 10 });
  }

  if (expected.status === "unknown") {
    return createFixedScore({ conclusion: "Weights for a course that has none", score: 6 });
  }

  return isSameWeighting({ expected: expected.weights, found: found.weights })
    ? createFixedScore({ conclusion: "None", score: 10 })
    : createFixedScore({
        conclusion: `Weights ${found.weights.join(", ")} differ from the published ${expected.weights.join(", ")}`,
        score: 6,
      });
};

export const findCourseWeightsTask: Task<
  FindCourseWeightsParams,
  CourseWeightsFinding,
  FindCourseWeightsExpected
> = {
  description:
    "Look up how a course weighs each part of an entrance exam at one institution, with the page that gives the weights, or say they aren't known",
  generate: findCourseWeights,
  id: "find-course-weights",
  latencyBudget: { p50: 25, p95: 40 },
  name: "Find Course Weights",
  score: scoreCourseWeights,
  testCases: TEST_CASES,
};
