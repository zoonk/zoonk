import { type Task } from "@/lib/types";
import {
  type PlacementItemsParams,
  generatePlacementItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "../generate-items/score-categories";
import { scorePlacementItems } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const placementItemsTask: Task<
  PlacementItemsParams,
  Awaited<ReturnType<typeof generatePlacementItems>>["data"]
> = {
  description:
    "Write placement questions for several skills in one call: a quick one (multiple choice, or true/false for an exam that judges assertions) and a typed one per skill. Code checks per skill, then the generate-items judge rubric, so scores compare with single-skill writing",
  generate: generatePlacementItems,
  id: "placement-items",
  name: "Placement Items",
  score: scorePlacementItems,
  scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
