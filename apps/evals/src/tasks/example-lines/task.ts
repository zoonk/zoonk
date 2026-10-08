import { type Task } from "@/lib/types";
import {
  type GenerateExampleLinesParams,
  generateExampleLines,
} from "@zoonk/ai/tasks/v2/variants/example-lines";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { EXAMPLE_LINES_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

type ExampleLinesOutput = Awaited<ReturnType<typeof generateExampleLines>>["data"];

export const exampleLinesTask: Task<
  Omit<GenerateExampleLinesParams, "analytics" | "model" | "reasoning" | "useFallback">,
  ExampleLinesOutput
> = {
  description:
    "Tie a lesson's explanations to one learner's life, a sentence per screen from the facts they shared, each a different moment, or nothing where nothing fits",
  generate: generateExampleLines,
  id: "example-lines",
  name: "Example Lines",
  scoreCategories: EXAMPLE_LINES_SCORE_CATEGORIES,
  testCases: [...TEST_CASES, ...PERSONA_TEST_CASES],
};
