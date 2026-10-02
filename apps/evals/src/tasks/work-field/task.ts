import { type Task } from "@/lib/types";
import {
  type WorkFieldParams,
  type WorkFieldResult,
  classifyWorkField,
} from "@zoonk/ai/tasks/v2/items/work-field";
import { type WorkFieldExpected, scoreWorkField } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const workFieldTask: Task<WorkFieldParams, WorkFieldResult, WorkFieldExpected> = {
  description:
    "Sorts a work or career-change learner's role into one shareable field (nursing, retail, law) for field practice and cases, or none",
  generate: classifyWorkField,
  id: "work-field",
  name: "Work Field",
  score: scoreWorkField,
  testCases: TEST_CASES,
};
