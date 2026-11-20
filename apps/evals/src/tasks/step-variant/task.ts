import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type GenerateStepVariantParams,
  generateStepVariant,
} from "@zoonk/ai/tasks/variants/step-variant";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { STEP_VARIANT_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

type StepVariantOutput = Awaited<ReturnType<typeof generateStepVariant>>["data"];

export const stepVariantTask: Task<
  OptionalCountry<
    Omit<GenerateStepVariantParams, "analytics" | "model" | "reasoning" | "useFallback">
  >,
  StepVariantOutput
> = {
  criteria: readCriteria(STEP_VARIANT_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Rewrite one lesson screen for the learner's field or tool, faithful to the original",
  generate: (input) => generateStepVariant({ ...input, country: input.country ?? null }),
  id: "step-variant",
  name: "Step variant",
  priorities: {
    comparison: {
      criteria: {
        faithful: "counts",
        plainLanguage: "counts",
        versionFit: "counts",
        writing: "counts",
      },
      preference: "separates",
      trade: null,
    },
    distribution: "shared",
    first: "cost",
    reads: "A learner reads a lesson screen rewritten for their field or tool",
    reason: "Stored per screen and version and reused; the cheapest that scored well and fast",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  scoreCategories: STEP_VARIANT_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
