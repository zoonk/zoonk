import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type CourseWeightsFinding,
  type FindCourseWeightsParams,
  findCourseWeights,
} from "@zoonk/ai/tasks/v2/research/find-course-weights";
import { TEST_CASES } from "./test-cases";

export type FindCourseWeightsExpected = {
  /**
   * Parts (1-based) a found answer must weigh at least as much as `than`: a medical course never
   * counts the humanities more than the natural sciences. Empty when nothing is expected.
   */
  atLeast: { part: number; than: number }[];
  /** `found` when the institution publishes the course's weights; `unknown` when none exist. */
  status: "found" | "unknown";
};

function parseOutput(output: string): CourseWeightsFinding | null {
  try {
    return JSON.parse(output) as CourseWeightsFinding;
  } catch {
    return null;
  }
}

/** The expected orderings a found answer breaks. */
function findWrongOrder({
  expected,
  weights,
}: {
  expected: FindCourseWeightsExpected;
  weights: readonly number[];
}): string[] {
  return expected.atLeast.flatMap(({ part, than }) => {
    const weight = weights[part - 1] ?? 0;
    const other = weights[than - 1] ?? 0;

    return weight >= other
      ? []
      : [`part ${part} (${weight}) weighs less than part ${than} (${other})`];
  });
}

/**
 * 10 for weights in a plausible order with their source (or "unknown" where none exist); 8 for
 * weights it missed, which only leaves the plan weighing parts evenly; 6 for weights that can't be
 * the course's or that were made up for a course with none, which would weigh the plan wrong.
 */
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

  const wrong = findWrongOrder({ expected, weights: found.weights });

  return wrong.length === 0
    ? createFixedScore({ conclusion: "None", score: 10 })
    : createFixedScore({ conclusion: wrong.join("; "), score: 6 });
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
