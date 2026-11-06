import { createBooleanEvaluation } from "@/lib/evaluation-routes";
import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { goalTutorSearchClassifier } from "@zoonk/ai/tasks/tutor/goal-tutor-search";
import { type GoalTutorSearchExpected, type GoalTutorSearchInput, TEST_CASES } from "./test-cases";

type GoalTutorSearchOutput = GoalTutorSearchExpected;

const route = createBooleanEvaluation({
  classifier: goalTutorSearchClassifier,
  toOutput: (needsCurrentSource): GoalTutorSearchOutput => ({ needsCurrentSource }),
});

function toLabel(needsCurrentSource: boolean | undefined): "answer" | "search" {
  return needsCurrentSource ? "search" : "answer";
}

/** A missed search answers from law that may have changed; a needless one only makes them wait. */
const MISSED_SCORE = { answer: 7, search: 5 } as const;

const scoreGoalTutorSearch: TaskScorer<GoalTutorSearchExpected> = ({ output, testCase }) => {
  const { needsCurrentSource } = JSON.parse(output) as GoalTutorSearchOutput;
  const expected = testCase.expected?.needsCurrentSource;
  const classification = { expected: toLabel(expected), predicted: toLabel(needsCurrentSource) };

  return {
    ...createFixedScore({
      conclusion: `Expected ${classification.expected}; got ${classification.predicted}.`,
      score: needsCurrentSource === expected ? 10 : MISSED_SCORE[classification.expected],
    }),
    classification,
  };
};

export const goalTutorSearchTask: Task<
  GoalTutorSearchInput,
  GoalTutorSearchOutput,
  GoalTutorSearchExpected
> = {
  description:
    "Decide whether the buddy must search the web before answering a learner's message, because the answer rests on facts that change",
  evaluate: route,
  generate: route,
  id: "goal-tutor-search",
  // Past `shouldSearchFirst`'s deadline the decision is dropped.
  latencyBudget: { p50: 1, p95: 2.5 },
  name: "Goal Tutor Search",
  score: scoreGoalTutorSearch,
  testCases: TEST_CASES,
};
