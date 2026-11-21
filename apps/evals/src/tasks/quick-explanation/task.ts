import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type OptionalCountry, type Task, type TaskCodeChecks } from "@/lib/types";
import {
  type QuickExplanation,
  type QuickExplanationParams,
  generateQuickExplanation,
  quickExplanationSchema,
} from "@zoonk/ai/tasks/explain/quick-explanation";
import { toExplanationSteps } from "@zoonk/core/library/explanations/explanation-steps";
import { z } from "zod";
import { readCriteria } from "../plain-language-criterion";
import { QUICK_EXPLANATION_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

const QUICK_EXPLANATION_LATENCY_BUDGET = { p50: 12, p95: 18 };

const checkOutput: TaskCodeChecks = ({ output }) => {
  const parsed = quickExplanationSchema.safeParse(JSON.parse(output));

  const problems = parsed.success
    ? toExplanationSteps(parsed.data).problems
    : [`The output doesn't match the task's schema: ${z.prettifyError(parsed.error)}`];

  return {
    blockingProblems: problems,
    judgedOutput: output,
    passed: problems.length === 0 ? 1 : 0,
    problems,
    total: 1,
  };
};

export const quickExplanationTask: Task<
  OptionalCountry<QuickExplanationParams>,
  QuickExplanation
> = {
  codeChecks: checkOutput,
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
      trade: COMPARISON_TRADES.core,
      weights: { accuracy: 3 },
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
      check: (value) => checkOutput({ output: value, testCase }),
      output,
      scoreCategories: QUICK_EXPLANATION_SCORE_CATEGORIES,
      testCase,
    }),
  scoreCategories: QUICK_EXPLANATION_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
