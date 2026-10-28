import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type FindTargetCutoffParams,
  type TargetCutoffFinding,
  findTargetCutoff,
} from "@zoonk/ai/tasks/v2/research/find-target-cutoff";
import { TEST_CASES } from "./test-cases";

export type FindTargetCutoffExpected = {
  range: { max: number; min: number } | null;
  maxScore?: number;
};

function parseOutput(output: string): TargetCutoffFinding | null {
  try {
    return JSON.parse(output) as TargetCutoffFinding;
  } catch {
    return null;
  }
}

const scoreTargetCutoff: TaskScorer<FindTargetCutoffExpected> = ({ output, testCase }) => {
  const found = parseOutput(output);
  const expected = testCase.expected;

  if (!found || !expected) {
    return createFixedScore({ conclusion: "No output", score: 6 });
  }

  if (found.status !== "found") {
    return expected.range
      ? createFixedScore({ conclusion: "Missed the published cut-off", score: 8 })
      : createFixedScore({ conclusion: "None", score: 10 });
  }

  if (!expected.range) {
    return createFixedScore({ conclusion: "A cut-off for a target that has none", score: 6 });
  }

  const inRange = found.score >= expected.range.min && found.score <= expected.range.max;

  if (!inRange) {
    return createFixedScore({ conclusion: `Cut-off ${found.score} out of range`, score: 6 });
  }

  if (expected.maxScore === undefined || found.maxScore === expected.maxScore) {
    return createFixedScore({ conclusion: "None", score: 10 });
  }

  return found.maxScore === null
    ? createFixedScore({ conclusion: "No scale, so the app shows no number", score: 8 })
    : createFixedScore({
        conclusion: `Scale up to ${found.maxScore}, not ${expected.maxScore}`,
        score: 6,
      });
};

export const findTargetCutoffTask: Task<
  FindTargetCutoffParams,
  TargetCutoffFinding,
  FindTargetCutoffExpected
> = {
  description:
    "Look up the last published cut-off of a learner's target (a course at an institution, a position) with its source, or say it isn't known",
  generate: findTargetCutoff,
  id: "find-target-cutoff",
  latencyBudget: { p50: 25, p95: 40 },
  name: "Find Target Cut-off",
  score: scoreTargetCutoff,
  testCases: TEST_CASES,
};
