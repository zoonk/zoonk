import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationDebriefParams,
  type ActivityInvestigationDebriefSchema,
  generateActivityInvestigationDebrief,
} from "@zoonk/ai/tasks/activities/core/investigation-debrief";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationDebriefTask: Task<
  ActivityInvestigationDebriefParams,
  ActivityInvestigationDebriefSchema
> = {
  description: "Generate the debrief reveal explanation for an investigation",
  generate: generateActivityInvestigationDebrief,
  id: "activity-investigation-debrief",
  name: "Activity Investigation Debrief",
  testCases: TEST_CASES,
};
