import { type Task } from "@/lib/types";
import {
  type AppliedActivityKindParams,
  type AppliedActivityKindSchema,
  generateAppliedActivityKind,
} from "@zoonk/ai/tasks/lessons/applied-activity-kind";
import { TEST_CASES } from "./test-cases";

export const appliedActivityKindTask: Task<AppliedActivityKindParams, AppliedActivityKindSchema> = {
  description:
    "Classify whether a lesson should include a story, investigation, or no applied activity",
  generate: generateAppliedActivityKind,
  id: "applied-activity-kind",
  name: "Applied Activity Kind",
  testCases: TEST_CASES,
};
