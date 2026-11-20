import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type GenerateExampleLinesParams,
  generateExampleLines,
} from "@zoonk/ai/tasks/variants/example-lines";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { EXAMPLE_LINES_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

type ExampleLinesOutput = Awaited<ReturnType<typeof generateExampleLines>>["data"];

export const exampleLinesTask: Task<
  OptionalCountry<
    Omit<
      GenerateExampleLinesParams,
      "analytics" | "learnerHomeCountry" | "model" | "reasoning" | "useFallback"
    > & { learnerHomeCountry?: string | null }
  >,
  ExampleLinesOutput
> = {
  criteria: readCriteria(EXAMPLE_LINES_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Tie a lesson's explanations to one learner's life, a sentence per screen from the facts they shared, each a different moment, or nothing where nothing fits",
  generate: (input) =>
    generateExampleLines({
      ...input,
      country: input.country ?? null,
      learnerHomeCountry: input.learnerHomeCountry ?? null,
    }),
  id: "example-lines",
  name: "Example lines",
  priorities: {
    comparison: {
      criteria: { accuracy: "counts", fit: "counts", plainLanguage: "counts", writing: "counts" },
      preference: "separates",
      trade: null,
    },
    distribution: "private",
    first: "cost",
    reads: "A learner reads an example line from their own life",
    reason: "One learner's line: the cheapest model that keeps the fit and the accuracy",
    waits: "A learner waits in the request",
  },
  scoreCategories: EXAMPLE_LINES_SCORE_CATEGORIES,
  testCases: [...TEST_CASES, ...PERSONA_TEST_CASES],
};
