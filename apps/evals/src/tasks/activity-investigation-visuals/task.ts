import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationVisualsParams,
  type ActivityInvestigationVisualsSchema,
  generateActivityInvestigationVisuals,
} from "@zoonk/ai/tasks/activities/core/investigation-visuals";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationVisualsTask: Task<
  ActivityInvestigationVisualsParams,
  ActivityInvestigationVisualsSchema
> = {
  description: "Generate visual kind and description for scenario and each finding",
  generate: generateActivityInvestigationVisuals,
  id: "activity-investigation-visuals",
  name: "Activity Investigation Visuals",
  testCases: TEST_CASES,
};
