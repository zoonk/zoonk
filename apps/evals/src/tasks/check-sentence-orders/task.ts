import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { checkSentenceOrders } from "@zoonk/ai/tasks/language/check-sentence-orders";
import {
  type SentenceOrders,
  keepReviewedCandidates,
} from "@zoonk/core/library/language/sentence-orders";
import {
  type CheckSentenceOrdersExpected,
  type CheckSentenceOrdersInput,
  type LabeledOrders,
  TEST_CASES,
} from "./test-cases";

type Verdicts = Parameters<typeof keepReviewedCandidates>[0]["verdicts"];

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

/**
 * A wrong order kept in a shared lesson marks a mistake right for everyone who studies it, with no
 * sign anything is off; a right order dropped costs one "Not quite" that shows the lesson's order.
 */
const KEPT_WRONG_COST = 3;

type SideCheck = { droppedValid: string[]; keptInvalid: string[]; maxCost: number };

/** The orders the review kept, or null when production would reject the review. */
function readKept({
  input,
  output,
}: {
  input: CheckSentenceOrdersInput;
  output: string;
}): SentenceOrders[] | null {
  try {
    return keepReviewedCandidates({
      candidates: input.sentences.map((sentence) => ({
        otherOrders: [...sentence.sentenceCandidates],
        otherTranslationOrders: [...sentence.translationCandidates],
      })),
      verdicts: JSON.parse(output) as Verdicts,
    });
  } catch {
    return null;
  }
}

function checkSide({ kept, labels }: { kept: string[]; labels: LabeledOrders }): SideCheck {
  const invalid = labels.invalid ?? [];
  const valid = labels.valid ?? [];

  return {
    droppedValid: valid.filter((order) => !kept.includes(order)),
    keptInvalid: invalid.filter((order) => kept.includes(order)),
    maxCost: invalid.length * KEPT_WRONG_COST + valid.length,
  };
}

function quote(orders: string[]): string {
  return orders.map((order) => `"${order}"`).join(", ");
}

/** Every kept wrong order costs three times a dropped right one; unscored orders cost nothing. */
const scoreVerdicts: TaskScorer<CheckSentenceOrdersExpected> = ({ output, testCase }) => {
  const kept = readKept({ input: testCase.userInput as CheckSentenceOrdersInput, output });

  if (!kept) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const checks = kept.flatMap((orders, index) => {
    const labels = testCase.expected?.sentences[index];

    return [
      checkSide({ kept: orders.otherOrders, labels: labels?.orders ?? {} }),
      checkSide({ kept: orders.otherTranslationOrders, labels: labels?.translationOrders ?? {} }),
    ];
  });

  const keptInvalid = checks.flatMap((check) => check.keptInvalid);
  const droppedValid = checks.flatMap((check) => check.droppedValid);
  const maxCost = checks.reduce((sum, check) => sum + check.maxCost, 0);
  const cost = keptInvalid.length * KEPT_WRONG_COST + droppedValid.length;

  const problems = [
    keptInvalid.length > 0 ? `Kept wrong: ${quote(keptInvalid)}.` : "",
    droppedValid.length > 0 ? `Dropped right: ${quote(droppedValid)}.` : "",
  ].filter(Boolean);

  return createFixedScore({
    conclusion: problems.length === 0 ? "None" : problems.join(" "),
    score: MIN_SCORE + SCORE_RANGE * (maxCost === 0 ? 1 : 1 - cost / maxCost),
  });
};

/** The reviewer alone, on fixed candidates, so any model can be measured without the writer's variance. */
export const checkSentenceOrdersTask: Task<
  CheckSentenceOrdersInput,
  Verdicts,
  CheckSentenceOrdersExpected
> = {
  description:
    "Keep or drop candidate word orders for a lesson's sentences the way a native teacher would, so learners are never marked right for a wrong order",
  generate: checkSentenceOrders,
  id: "check-sentence-orders",
  name: "Check sentence orders",
  score: scoreVerdicts,
  testCases: TEST_CASES,
};
