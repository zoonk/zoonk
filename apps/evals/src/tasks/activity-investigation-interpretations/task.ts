import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationInterpretationsParams,
  type ActivityInvestigationInterpretationsSchema,
  generateActivityInvestigationInterpretations,
} from "@zoonk/ai/tasks/activities/core/investigation-interpretations";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationInterpretationsTask: Task<
  ActivityInvestigationInterpretationsParams,
  ActivityInvestigationInterpretationsSchema
> = {
  description:
    "Generate interpretation statements for each finding from one explanation's perspective",
  generate: generateActivityInvestigationInterpretations,
  id: "activity-investigation-interpretations",
  name: "Activity Investigation Interpretations",
  testCases: TEST_CASES,
};
