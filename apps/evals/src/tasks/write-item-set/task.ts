import { type Task } from "@/lib/types";
import { type WriteItemSetParams, writeItemSet } from "@zoonk/ai/tasks/v2/items/write-set";
import { WRITE_ITEM_SET_SCORE_CATEGORIES } from "./score-categories";
import { scoreWriteItemSet } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const writeItemSetTask: Task<
  WriteItemSetParams,
  Awaited<ReturnType<typeof writeItemSet>>["data"]
> = {
  description:
    "Write one question set for an exam: an original passage, case or chart and several questions that need it, each with the stimulus words that settle it: code checks (stimulus length and kind, evidence found in the stimulus, skills, item checks), then a judge on right keys, needing the stimulus and exam realism",
  generate: writeItemSet,
  id: "write-item-set",
  name: "Write Item Set",
  score: scoreWriteItemSet,
  scoreCategories: WRITE_ITEM_SET_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
