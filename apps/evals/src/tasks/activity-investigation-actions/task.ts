import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationActionsParams,
  type ActivityInvestigationActionsSchema,
  generateActivityInvestigationActions,
} from "@zoonk/ai/tasks/activities/core/investigation-actions";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationActionsTask: Task<
  ActivityInvestigationActionsParams,
  ActivityInvestigationActionsSchema
> = {
  description: "Generate investigation actions with quality tiers for a scenario",
  generate: generateActivityInvestigationActions,
  id: "activity-investigation-actions",
  name: "Activity Investigation Actions",
  testCases: TEST_CASES,
};
