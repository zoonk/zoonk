import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type RecallOverlap, checkRecallOverlap } from "@zoonk/ai/tasks/items/check-recall-overlap";
import {
  type CheckRecallOverlapExpected,
  type CheckRecallOverlapInput,
  TEST_CASES,
} from "./test-cases";

type CheckRecallOverlapOutput = { repeats: RecallOverlap[] };

const MISSED_REPEAT_SCORE = 6;
const PASSING_FLOOR = 8;
const KEPT_NEW_POINTS = 2;

const scoreCheckRecallOverlap: TaskScorer<CheckRecallOverlapExpected> = ({ output, testCase }) => {
  const expected = testCase.expected?.repeats;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected repeats.`);
  }

  const { repeats } = JSON.parse(output) as CheckRecallOverlapOutput;

  const verdicts = expected.map((repeated, index) => ({
    expected: repeated,
    flagged: repeats.find((entry) => entry.candidate === index),
    number: index + 1,
  }));

  const missed = verdicts.filter((verdict) => verdict.expected !== null && !verdict.flagged);
  const fresh = verdicts.filter((verdict) => verdict.expected === null);
  const falseRepeats = fresh.filter((verdict) => verdict.flagged);
  const keptRate = fresh.length === 0 ? 1 : (fresh.length - falseRepeats.length) / fresh.length;

  const repeated = verdicts.length - fresh.length;

  const conclusion = [
    `Caught ${repeated - missed.length} of ${repeated} repeats; kept ${fresh.length - falseRepeats.length} of ${fresh.length} new questions.`,
    ...missed.map(
      ({ expected: earlier, number }) =>
        `Missed candidate ${number}, which repeats earlier ${earlier}.`,
    ),
    ...falseRepeats.map(
      ({ flagged, number }) => `Dropped new candidate ${number}: ${flagged?.reason ?? ""}`,
    ),
  ].join(" ");

  const score =
    missed.length > 0 ? MISSED_REPEAT_SCORE : PASSING_FLOOR + KEPT_NEW_POINTS * keptRate;

  return createFixedScore({ conclusion, score });
};

export const checkRecallOverlapTask: Task<
  CheckRecallOverlapInput,
  CheckRecallOverlapOutput,
  CheckRecallOverlapExpected
> = {
  description:
    "Find new mock questions a learner could answer by remembering an earlier one (the same statement or case reworded, negated or renamed), while the same rule asked in a case of its own stays new",
  generate: checkRecallOverlap,
  id: "check-recall-overlap",
  name: "Check recall overlap",
  score: scoreCheckRecallOverlap,
  testCases: TEST_CASES,
};
