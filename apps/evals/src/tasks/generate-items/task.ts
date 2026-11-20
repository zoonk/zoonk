import { type OptionalCountry, type Task } from "@/lib/types";
import { type GenerateItemsParams, generateItems } from "@zoonk/ai/tasks/items/generate";
import { readCriteria } from "../plain-language-criterion";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "./score-categories";
import { scoreGeneratedItems } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const generateItemsTask: Task<
  OptionalCountry<GenerateItemsParams>,
  Awaited<ReturnType<typeof generateItems>>["data"]
> = {
  criteria: readCriteria(GENERATE_ITEMS_SCORE_CATEGORIES),
  description:
    "Write practice and exam items for a skill and format: code checks (one right answer, distinct options, a misconception per wrong option, math recomputed), then a judge on correctness and exam realism",
  generate: (input) => generateItems({ ...input, country: input.country ?? null }),
  id: "generate-items",
  name: "Generate items",
  priorities: {
    comparison: {
      criteria: {
        correctness: "disqualifies",
        misconceptionsAndFeedback: "counts",
        realism: "counts",
        skillFit: "counts",
      },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner answers the questions and reads their feedback",
    reason: "Shared items: a wrong key reaches every learner",
    waits: "Prepared ahead or in the background",
  },
  score: scoreGeneratedItems,
  scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
