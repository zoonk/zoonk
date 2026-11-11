import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type ItemSolution, solveItems } from "@zoonk/ai/tasks/items/solve";
import { findKeyMismatch } from "@zoonk/core/library/items/key-mismatch";
import { type SolveItemsExpected, type SolveItemsInput, TEST_CASES } from "./test-cases";

type SolveItemsOutput = { solutions: (ItemSolution | null)[] };

const MISSED_WRONG_KEY_SCORE = 6;
const PASSING_FLOOR = 8;
const KEPT_RIGHT_POINTS = 2;

/**
 * A missed wrong key reaches every learner who gets the shared item, so a checker that misses one
 * fails; past that bar, the score rises with the share of right items kept.
 */
function toScore({ keptRate, missed }: { keptRate: number; missed: number }): number {
  return missed > 0 ? MISSED_WRONG_KEY_SCORE : PASSING_FLOOR + KEPT_RIGHT_POINTS * keptRate;
}

const scoreSolveItems: TaskScorer<SolveItemsExpected> = ({ output, testCase }) => {
  const { expected } = testCase;
  const { items } = testCase.userInput as SolveItemsInput;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const { solutions } = JSON.parse(output) as SolveItemsOutput;

  const verdicts = items.map((item, index) => ({
    number: index + 1,
    reason: findKeyMismatch({ item, solution: solutions[index] ?? null }),
  }));

  const missed = verdicts.filter(({ number, reason }) => expected.drop.includes(number) && !reason);
  const right = verdicts.filter(({ number }) => !expected.drop.includes(number));
  const falseDrops = right.filter(({ reason }) => reason);
  const keptRate = right.length === 0 ? 1 : (right.length - falseDrops.length) / right.length;

  const conclusion = [
    `Caught ${expected.drop.length - missed.length} of ${expected.drop.length} wrong keys; kept ${right.length - falseDrops.length} of ${right.length} right items.`,
    ...missed.map(({ number }) => `Missed the wrong key of item ${number}.`),
    ...falseDrops.map(({ number, reason }) => `Dropped right item ${number}: ${reason}`),
  ].join(" ");

  return createFixedScore({ conclusion, score: toScore({ keptRate, missed: missed.length }) });
};

export const solveItemsTask: Task<SolveItemsInput, SolveItemsOutput, SolveItemsExpected> = {
  description:
    "Solve multiple-choice and true/false items without their keys, so code drops each item whose key the solve doesn't reproduce: catch wrong keys, items with no right option and true/false keys a board would mark the other way, and keep hard right items",
  generate: solveItems,
  id: "solve-items",
  name: "Solve Items (key check)",
  score: scoreSolveItems,
  testCases: TEST_CASES,
};
