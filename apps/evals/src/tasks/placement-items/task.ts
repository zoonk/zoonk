import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type PlacementItemsParams,
  generatePlacementItems,
} from "@zoonk/ai/tasks/items/placement-items";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "../generate-items/score-categories";
import { readCriteria } from "../plain-language-criterion";
import { checkPlacementItems, scorePlacementItems } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const placementItemsTask: Task<
  OptionalCountry<PlacementItemsParams>,
  Awaited<ReturnType<typeof generatePlacementItems>>["data"]
> = {
  codeChecks: checkPlacementItems,
  criteria: readCriteria(GENERATE_ITEMS_SCORE_CATEGORIES),
  description:
    "Write placement questions for several skills in one call: quick ones (multiple choice, or true/false for an exam that judges assertions) and the low-guess tap questions that confirm them (match pairs, an order or select-all). Code checks per skill, then the generate-items judge rubric, so scores compare with single-skill writing",
  generate: (input) => generatePlacementItems({ ...input, country: input.country ?? null }),
  id: "placement-items",
  name: "Placement items",
  priorities: {
    comparison: {
      criteria: {
        correctness: "counts",
        misconceptionsAndFeedback: "counts",
        realism: "counts",
        skillFit: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.shared,
      weights: { correctness: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner answers placement questions",
    reason: "Right keys outweigh a longer first wait; kept per skill and reused",
    waits: "Prepared ahead; the wait comes from the caller",
  },
  requiresAnswerKeyCheck: true,
  score: scorePlacementItems,
  scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
