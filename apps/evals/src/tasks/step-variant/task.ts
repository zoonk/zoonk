import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type OptionalCountry, type Task, type TaskCodeChecks } from "@/lib/types";
import {
  type GenerateStepVariantParams,
  generateStepVariant,
} from "@zoonk/ai/tasks/variants/step-variant";
import { toVariantContent } from "@zoonk/core/library/variants/variant-content";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { STEP_VARIANT_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

type StepVariantOutput = Awaited<ReturnType<typeof generateStepVariant>>["data"];

const checkOutput: TaskCodeChecks = ({ output, testCase }) => {
  const { language, level, screen } = testCase.userInput as GenerateStepVariantParams;

  const checked = toVariantContent({
    language,
    level,
    original: screen.content,
    stepKind: screen.kind,
    written: JSON.parse(output) as StepVariantOutput,
  });

  return {
    criteria: ["writing"],
    judgedOutput: output,
    passed: Number(checked.ok),
    problems: checked.ok ? [] : checked.problems,
    total: 1,
  };
};

export const stepVariantTask: Task<
  OptionalCountry<
    Omit<GenerateStepVariantParams, "analytics" | "model" | "reasoning" | "useFallback">
  >,
  StepVariantOutput
> = {
  codeChecks: checkOutput,
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
      trade: COMPARISON_TRADES.core,
      weights: { faithful: 3 },
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
