import { type Task } from "@/lib/types";
import {
  type WorkFieldParams,
  type WorkFieldResult,
  classifyWorkField,
} from "@zoonk/ai/tasks/items/work-field";
import { type WorkFieldExpected, scoreWorkField } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const workFieldTask: Task<WorkFieldParams, WorkFieldResult, WorkFieldExpected> = {
  description:
    "Sorts a work or career-change learner's role into one shareable field (nursing, retail, law) for field practice and cases, or none",
  generate: classifyWorkField,
  id: "work-field",
  name: "Work field",
  priorities: {
    distribution: "private",
    first: "cost",
    reads: "Code stores the work field that picks the item set",
    reason: "Background: both models were right, so the cheaper",
    waits: "Nobody: background work",
  },
  score: scoreWorkField,
  testCases: TEST_CASES,
};
