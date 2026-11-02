import { createFixedScore, generateScore } from "./score";
import { calculateScore } from "./score-calculation";
import {
  type ScoreCategory,
  type TaskScoreResult,
  type TestCase,
  getJudgeExpectations,
} from "./types";

export type CodeCheckResult = {
  passed: number;
  total: number;
  problems: string[];
  judgedOutput: string;
};

const CODE_CHECKS_CATEGORY_ID = "codeChecks";
const MIN_SCORE = 6;
const MAX_SCORE = 10;

const CODE_CHECKS_WEIGHT = 30;

function getCodeChecksCategory(check: CodeCheckResult) {
  const passRate = check.total === 0 ? 0 : check.passed / check.total;

  return {
    categoryId: CODE_CHECKS_CATEGORY_ID,
    label: "Code checks",
    reasoning:
      check.problems.length === 0
        ? `All ${check.total} parts passed the code checks.`
        : `${check.passed} of ${check.total} parts passed. ${check.problems.join(" ")}`,
    score: 1 + (MAX_SCORE - 1) * passRate,
    weight: CODE_CHECKS_WEIGHT,
  };
}

export async function scoreWithCodeChecks({
  check,
  output,
  scoreCategories,
  testCase,
}: {
  check: (output: string) => CodeCheckResult | Promise<CodeCheckResult>;
  output: string;
  scoreCategories: ScoreCategory[];
  testCase: TestCase;
}): Promise<TaskScoreResult> {
  const result = await check(output);

  if (result.passed === 0) {
    return createFixedScore({
      conclusion: `No part passed the code checks. ${result.problems.join(" ")}`,
      score: MIN_SCORE,
    });
  }

  const judged = await generateScore({
    expectations: getJudgeExpectations(testCase),
    output: result.judgedOutput,
    prompt: JSON.stringify(testCase.userInput, null, 2),
    scoreCategories,
  });

  const categoryScores = [...(judged.categoryScores ?? []), getCodeChecksCategory(result)];

  return {
    ...judged,
    categoryScores,
    score: calculateScore({ categoryScores, steps: judged.steps }),
  };
}
