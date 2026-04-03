import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationParams,
  type ActivityInvestigationSchema,
  generateActivityInvestigation,
} from "@zoonk/ai/tasks/activities/core/investigation";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationTask: Task<
  ActivityInvestigationParams,
  ActivityInvestigationSchema
> = {
  description:
    "Generate an investigation activity where learners form hypotheses, gather ambiguous evidence, and draw nuanced conclusions",
  generate: generateActivityInvestigation,
  id: "activity-investigation",
  name: "Activity Investigation",
  testCases: TEST_CASES,
};
