import { type Task } from "@/lib/types";
import { type GenerateItemsParams, generateItems } from "@zoonk/ai/tasks/v2/items/generate";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "./score-categories";
import { scoreGeneratedItems } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const generateItemsTask: Task<
  GenerateItemsParams,
  Awaited<ReturnType<typeof generateItems>>["data"]
> = {
  description:
    "Write practice and exam items for a skill and format: code checks (one right answer, distinct options, a misconception per wrong option, math recomputed), then a judge on correctness and exam realism",
  generate: generateItems,
  id: "generate-items",
  name: "Generate Items",
  score: scoreGeneratedItems,
  scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
