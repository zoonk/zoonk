import { type Task } from "@/lib/types";
import {
  type GenerateExampleLineParams,
  generateExampleLine,
} from "@zoonk/ai/tasks/v2/variants/example-line";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { EXAMPLE_LINE_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

type ExampleLineOutput = Awaited<ReturnType<typeof generateExampleLine>>["data"];

export const exampleLineTask: Task<
  Omit<GenerateExampleLineParams, "analytics" | "model" | "reasoning" | "useFallback">,
  ExampleLineOutput
> = {
  description:
    "Tie one explanation to one learner's life in a sentence, from the facts they shared, or return nothing when nothing fits",
  generate: generateExampleLine,
  id: "example-line",
  name: "Example Line",
  scoreCategories: EXAMPLE_LINE_SCORE_CATEGORIES,
  testCases: [...TEST_CASES, ...PERSONA_TEST_CASES],
};
