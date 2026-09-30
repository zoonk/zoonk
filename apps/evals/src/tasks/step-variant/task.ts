import { type Task } from "@/lib/types";
import {
  type GenerateStepVariantParams,
  generateStepVariant,
} from "@zoonk/ai/tasks/v2/variants/step-variant";
import { STEP_VARIANT_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

/**
 * The learner taps "Simpler" or "Go deeper" and waits on the same screen, so a
 * rewrite should usually land within a few seconds and rarely take longer than six.
 */
const STEP_VARIANT_LATENCY_BUDGET = { p50: 4, p95: 6 };

type StepVariantOutput = Awaited<ReturnType<typeof generateStepVariant>>["data"];

export const stepVariantTask: Task<
  Omit<GenerateStepVariantParams, "analytics" | "model" | "reasoning" | "useFallback">,
  StepVariantOutput
> = {
  description:
    'Rewrite one lesson screen as "Simpler" or "Go deeper" (or for a field or tool), faithful to the original, while the learner waits',
  generate: generateStepVariant,
  id: "step-variant",
  latencyBudget: STEP_VARIANT_LATENCY_BUDGET,
  name: "Step Variant",
  scoreCategories: STEP_VARIANT_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
