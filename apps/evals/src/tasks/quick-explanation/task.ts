import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type QuickExplanation,
  type QuickExplanationParams,
  generateQuickExplanation,
  quickExplanationSchema,
} from "@zoonk/ai/tasks/explain/quick-explanation";
import { checkQuickExplanation } from "@zoonk/ai/tasks/explain/quick-explanation-checks";
import { z } from "zod";
import { readCriteria } from "../plain-language-criterion";
import { QUICK_EXPLANATION_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

const QUICK_EXPLANATION_LATENCY_BUDGET = { p50: 12, p95: 18 };

function checkOutput(output: string): CodeCheckResult {
  const parsed = quickExplanationSchema.safeParse(JSON.parse(output));

  const problems = parsed.success
    ? checkQuickExplanation(parsed.data)
    : [`The output doesn't match the task's schema: ${z.prettifyError(parsed.error)}`];

  return { judgedOutput: output, passed: problems.length === 0 ? 1 : 0, problems, total: 1 };
}

export const quickExplanationTask: Task<
  OptionalCountry<QuickExplanationParams>,
  QuickExplanation
> = {
  criteria: readCriteria(QUICK_EXPLANATION_SCORE_CATEGORIES),
  description:
    "Answer a question in 4 to 6 short screens with one check, a 'Now you know' recap and a 'Want to go further?' hint: code checks, then a judge",
  generate: (input) => generateQuickExplanation({ ...input, country: input.country ?? null }),
  id: "quick-explanation",
  latencyBudget: QUICK_EXPLANATION_LATENCY_BUDGET,
  name: "Quick explanation",
  priorities: {
    comparison: {
      criteria: {
        accuracy: "counts",
        check: "counts",
        clarity: "counts",
        ending: "counts",
        everydayWords: "counts",
        practicalExample: "counts",
      },
      preference: "separates",
      trade: null,
    },
    distribution: "shared",
    first: "latency",
    reads: "A learner reads the explanation",
    reason:
      "The first screen must arrive fast; a pricier model scored a little higher at eight times the cost",
    waits: "A learner waits: the first screen should show in about 20 seconds",
  },
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
