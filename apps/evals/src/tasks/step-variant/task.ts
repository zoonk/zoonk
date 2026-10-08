import { type Task } from "@/lib/types";
import {
  type GenerateStepVariantParams,
  generateStepVariant,
} from "@zoonk/ai/tasks/v2/variants/step-variant";
import { STEP_VARIANT_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

type StepVariantOutput = Awaited<ReturnType<typeof generateStepVariant>>["data"];

export const stepVariantTask: Task<
  Omit<GenerateStepVariantParams, "analytics" | "model" | "reasoning" | "useFallback">,
  StepVariantOutput
> = {
  description:
    "Rewrite one lesson screen for the learner's field or tool, faithful to the original",
  generate: generateStepVariant,
  id: "step-variant",
  name: "Step Variant",
  scoreCategories: STEP_VARIANT_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
