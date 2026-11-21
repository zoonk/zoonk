import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { checkSentenceOrders } from "@zoonk/ai/tasks/language/check-sentence-orders";
import {
  type CheckSentenceOrdersExpected,
  type CheckSentenceOrdersInput,
  type LabeledOrders,
  TEST_CASES,
} from "./test-cases";

type Verdicts = { sentences: { sentenceKeep: boolean[]; translationKeep?: boolean[] }[] };

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

/**
 * A wrong order kept in a shared lesson marks a mistake right for everyone who studies it, with no
 * sign anything is off; a right order dropped costs one "Not quite" that shows the lesson's order.
 */
const KEPT_WRONG_COST = 3;

type SideCheck = { droppedValid: string[]; keptInvalid: string[]; maxCost: number };

function parseVerdicts(output: string): Verdicts | null {
  try {
    return JSON.parse(output) as Verdicts;
  } catch {
    return null;
  }
}

function checkSide({
  candidates,
  keep = [],
  labels,
}: {
  candidates: readonly string[];
  keep?: readonly boolean[];
  labels: LabeledOrders;
}): SideCheck {
  const invalid = new Set(labels.invalid);
  const valid = new Set(labels.valid);
  const kept = (index: number) => keep[index] === true;

  return {
    droppedValid: candidates.filter((order, index) => valid.has(order) && !kept(index)),
    keptInvalid: candidates.filter((order, index) => invalid.has(order) && kept(index)),
    maxCost: invalid.size * KEPT_WRONG_COST + valid.size,
  };
}

function quote(orders: string[]): string {
  return orders.map((order) => `"${order}"`).join(", ");
}

/** Every kept wrong order costs three times a dropped right one; unscored orders cost nothing. */
const scoreVerdicts: TaskScorer<CheckSentenceOrdersExpected> = ({ output, testCase }) => {
  const verdicts = parseVerdicts(output);
  const input = testCase.userInput as CheckSentenceOrdersInput;

  if (!verdicts) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const checks = input.sentences.flatMap((sentence, index) => {
    const labels = testCase.expected?.sentences[index];
    const judged = verdicts.sentences[index];

    return [
      checkSide({
        candidates: sentence.sentenceCandidates,
        keep: judged?.sentenceKeep,
        labels: labels?.orders ?? {},
      }),
      checkSide({
        candidates: sentence.translationCandidates,
        keep: judged?.translationKeep,
        labels: labels?.translationOrders ?? {},
      }),
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
