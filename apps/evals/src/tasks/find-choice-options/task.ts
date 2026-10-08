import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type ChoiceOptionsFinding,
  type FindChoiceOptionsParams,
  findChoiceOptions,
} from "@zoonk/ai/tasks/v2/research/find-choice-options";
import { TEST_CASES } from "./test-cases";

export type FindChoiceOptionsExpected = {
  /** The options every recent edition's questions had. */
  options: number;
};

function parseOutput(output: string): ChoiceOptionsFinding | null {
  try {
    return JSON.parse(output) as ChoiceOptionsFinding;
  } catch {
    return null;
  }
}

/**
 * 10 for the options the latest editions had, with their source; 8 for a miss, which only leaves
 * the exam's questions written with the app's default; 4 for a wrong number, which would write
 * and pick every question for the exam with it.
 */
const scoreChoiceOptions: TaskScorer<FindChoiceOptionsExpected> = ({ output, testCase }) => {
  const found = parseOutput(output);
  const expected = testCase.expected;

  if (!found || !expected) {
    return createFixedScore({ conclusion: "No output", score: 4 });
  }

  if (found.status !== "found") {
    return createFixedScore({ conclusion: "Missed the published number", score: 8 });
  }

  return found.options === expected.options
    ? createFixedScore({ conclusion: "None", score: 10 })
    : createFixedScore({
        conclusion: `${found.options} options instead of ${expected.options}`,
        score: 4,
      });
};

export const findChoiceOptionsTask: Task<
  FindChoiceOptionsParams,
  ChoiceOptionsFinding,
  FindChoiceOptionsExpected
> = {
  description:
    "Look up how many options an exam's multiple-choice questions have, with the page that shows it, or say it isn't known",
  generate: findChoiceOptions,
  id: "find-choice-options",
  latencyBudget: { p50: 20, p95: 35 },
  name: "Find Choice Options",
  score: scoreChoiceOptions,
  testCases: TEST_CASES,
};
