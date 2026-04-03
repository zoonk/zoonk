import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationFindingsParams,
  type ActivityInvestigationFindingsSchema,
  generateActivityInvestigationFindings,
} from "@zoonk/ai/tasks/activities/core/investigation-findings";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationFindingsTask: Task<
  ActivityInvestigationFindingsParams,
  ActivityInvestigationFindingsSchema
> = {
  description: "Generate deliberately ambiguous findings for each investigation action",
  generate: generateActivityInvestigationFindings,
  id: "activity-investigation-findings",
  name: "Activity Investigation Findings",
  testCases: TEST_CASES,
};
