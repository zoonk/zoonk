import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type CheckCitedFactsParams,
  checkCitedFacts,
} from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { TEST_CASES } from "./test-cases";

export type CheckCitedFactsExpected = { supportedIds: string[] };

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function parseSupported(output: string): Set<string> | null {
  try {
    const parsed = JSON.parse(output) as { supportedIds: string[] };
    return new Set(parsed.supportedIds);
  } catch {
    return null;
  }
}

/** Share of facts judged right, with the wrongly accepted ones named, since those reach learners. */
const scoreCheck: TaskScorer<CheckCitedFactsExpected> = ({ output, testCase }) => {
  const supported = parseSupported(output);
  const facts = (testCase.userInput as unknown as CheckCitedFactsParams).facts;
  const expected = new Set(testCase.expected?.supportedIds);

  if (!supported) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const wrong = facts.filter((fact) => supported.has(fact.id) !== expected.has(fact.id));
  const accepted = wrong.filter((fact) => supported.has(fact.id)).map((fact) => fact.id);

  return createFixedScore({
    conclusion:
      wrong.length === 0
        ? "None"
        : `Wrong verdicts: ${wrong.map((fact) => fact.id).join(", ")}${accepted.length > 0 ? `. Accepted unsupported: ${accepted.join(", ")}` : ""}`,
    score: MIN_SCORE + (SCORE_RANGE * (facts.length - wrong.length)) / facts.length,
  });
};

export const checkCitedFactsTask: Task<
  CheckCitedFactsParams,
  { supportedIds: string[] },
  CheckCitedFactsExpected
> = {
  description: "Reject extracted exam facts that say more than their quoted passage",
  generate: checkCitedFacts,
  id: "check-cited-facts",
  name: "Check Cited Facts",
  score: scoreCheck,
  testCases: TEST_CASES,
};
