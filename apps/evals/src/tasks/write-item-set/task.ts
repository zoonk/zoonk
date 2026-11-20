import { type OptionalCountry, type Task } from "@/lib/types";
import { type WriteItemSetParams, writeItemSet } from "@zoonk/ai/tasks/items/write-set";
import { readCriteria } from "../plain-language-criterion";
import { WRITE_ITEM_SET_SCORE_CATEGORIES } from "./score-categories";
import { checkWriteItemSetOutput, scoreWriteItemSet } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const writeItemSetTask: Task<
  OptionalCountry<WriteItemSetParams>,
  Awaited<ReturnType<typeof writeItemSet>>["data"]
> = {
  codeChecks: checkWriteItemSetOutput,
  criteria: readCriteria(WRITE_ITEM_SET_SCORE_CATEGORIES),
  description:
    "Write one question set for an exam: an original passage, case or chart and several questions that need it, each with the stimulus words that settle it: code checks (stimulus length and kind, evidence found in the stimulus, skills, item checks), then a judge on right keys, needing the stimulus and exam realism",
  generate: (input) => writeItemSet({ ...input, country: input.country ?? null }),
  id: "write-item-set",
  name: "Write item set",
  priorities: {
    comparison: {
      criteria: { examRealism: "counts", keys: "disqualifies", stimulus: "counts" },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner practices the items",
    reason: "Shared items; a pricier model's small gain wasn't worth ten times the cost",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  requiresAnswerKeyCheck: true,
  score: scoreWriteItemSet,
  scoreCategories: WRITE_ITEM_SET_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
