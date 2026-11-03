import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type WarmUpCardVerdict,
  checkWarmUpCards,
} from "@zoonk/ai/tasks/warm-up/check-warm-up-cards";
import { TEST_CASES, type WarmUpCheckExpected, type WarmUpCheckInput } from "./test-cases";

type WarmUpCheckOutput = { verdicts: WarmUpCardVerdict[] };

/** The production writer: its family never reviews, so evals see the same reviewers. */
const WRITER_MODEL = "openai/gpt-6-luna";

const MISSED_PLANTED_SCORE = 6;
const TOO_STRICT_SCORE = 7;
const MIN_CLEAN_KEPT = 0.8;
const PASSING_FLOOR = 8;
const CLEAN_KEPT_POINTS = 2;

/**
 * A checker qualifies only when it catches every planted error and keeps at least 80% of the
 * clean cards; past that bar, the score rises with the share of clean cards kept.
 */
function toScore({ keptRate, missed }: { keptRate: number; missed: number }): number {
  if (missed > 0) {
    return MISSED_PLANTED_SCORE;
  }

  return keptRate < MIN_CLEAN_KEPT
    ? TOO_STRICT_SCORE
    : PASSING_FLOOR + CLEAN_KEPT_POINTS * keptRate;
}

const scoreWarmUpCheck: TaskScorer<WarmUpCheckExpected> = ({ output, testCase }) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const { planted } = testCase.expected;
  const { verdicts } = JSON.parse(output) as WarmUpCheckOutput;
  const missed = verdicts.filter((verdict) => planted.includes(verdict.id) && verdict.keep);
  const clean = verdicts.filter((verdict) => !planted.includes(verdict.id));
  const droppedClean = clean.filter((verdict) => !verdict.keep);
  const keptRate = clean.length === 0 ? 1 : (clean.length - droppedClean.length) / clean.length;

  const conclusion = [
    `Caught ${planted.length - missed.length} of ${planted.length} planted errors; kept ${clean.length - droppedClean.length} of ${clean.length} clean cards.`,
    ...missed.map((verdict) => `Missed planted card ${verdict.id}.`),
    ...droppedClean.map((verdict) => `Dropped clean card ${verdict.id}: ${verdict.problem}`),
  ].join(" ");

  return createFixedScore({ conclusion, score: toScore({ keptRate, missed: missed.length }) });
};

export const warmUpCheckTask: Task<WarmUpCheckInput, WarmUpCheckOutput, WarmUpCheckExpected> = {
  description:
    "Check warm-up guess cards as a subject expert from another model family: drop wrong keys, second right answers, myths, stale numbers, exam rules, quotes, contradicting reveals and regional usage shown as universal; keep clean cards",
  generate: (input) => checkWarmUpCards({ ...input, writerModel: WRITER_MODEL }),
  id: "warm-up-check",
  name: "Warm-Up Check",
  score: scoreWarmUpCheck,
  testCases: TEST_CASES,
};
