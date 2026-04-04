import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationVisualParams,
  type ActivityInvestigationVisualSchema,
  generateInvestigationVisual,
} from "@zoonk/ai/tasks/activities/core/investigation-visuals";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationVisualTask: Task<
  ActivityInvestigationVisualParams,
  ActivityInvestigationVisualSchema
> = {
  description: "Generate visual kind and description for a scenario or single finding",
  generate: generateInvestigationVisual,
  id: "activity-investigation-visual",
  name: "Activity Investigation Visual",
  testCases: TEST_CASES,
};
