import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type Task } from "@/lib/types";
import {
  type QuickExplanation,
  type QuickExplanationParams,
  generateQuickExplanation,
} from "@zoonk/ai/tasks/v2/explain/quick-explanation";
import { checkQuickExplanation } from "@zoonk/ai/tasks/v2/explain/quick-explanation-checks";
import { QUICK_EXPLANATION_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

/**
 * The first screen should show in about 20 seconds, and the generality check,
 * the save and the page load come on top of this call.
 */
const QUICK_EXPLANATION_LATENCY_BUDGET = { p50: 12, p95: 18 };

/** The explanation is one part: it ships whole or not at all. */
function checkOutput(output: string): CodeCheckResult {
  const problems = checkQuickExplanation(JSON.parse(output) as QuickExplanation);

  return { judgedOutput: output, passed: problems.length === 0 ? 1 : 0, problems, total: 1 };
}

export const quickExplanationTask: Task<QuickExplanationParams, QuickExplanation> = {
  description:
    "Answer a question in 4 to 6 short screens with one check, a 'Now you know' recap and a 'Want to go further?' hint: code checks, then a judge",
  generate: generateQuickExplanation,
  id: "quick-explanation",
  latencyBudget: QUICK_EXPLANATION_LATENCY_BUDGET,
  name: "Quick Explanation",
  score: ({ output, testCase }) =>
    scoreWithCodeChecks({
      check: checkOutput,
      output,
      scoreCategories: QUICK_EXPLANATION_SCORE_CATEGORIES,
      testCase,
    }),
  scoreCategories: QUICK_EXPLANATION_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
