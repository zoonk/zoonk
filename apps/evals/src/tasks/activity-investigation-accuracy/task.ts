import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationAccuracyParams,
  type ActivityInvestigationAccuracySchema,
  generateActivityInvestigationAccuracy,
} from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationAccuracyTask: Task<
  ActivityInvestigationAccuracyParams,
  ActivityInvestigationAccuracySchema
> = {
  description: "Assign accuracy tiers (best/partial/wrong) to investigation explanations",
  generate: generateActivityInvestigationAccuracy,
  id: "activity-investigation-accuracy",
  name: "Activity Investigation Accuracy",
  testCases: TEST_CASES,
};
