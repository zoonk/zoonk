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
    "Write placement questions for several skills in one call: a quick one (multiple choice, or true/false for an exam that judges assertions) and a typed one per skill. Code checks per skill, then the generate-items judge rubric, so scores compare with single-skill writing",
  generate: (input) => generatePlacementItems({ ...input, country: input.country ?? null }),
  id: "placement-items",
  name: "Placement items",
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
    reads: "A learner answers placement questions",
    reason: "Right keys outweigh a longer first wait; kept per skill and reused",
    waits: "Prepared ahead; the wait comes from the caller",
  },
  requiresAnswerKeyCheck: true,
  score: scorePlacementItems,
  scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
