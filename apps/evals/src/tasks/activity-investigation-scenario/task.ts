import { type Task } from "@/lib/types";
import {
  type ActivityInvestigationScenarioParams,
  type ActivityInvestigationScenarioSchema,
  generateActivityInvestigationScenario,
} from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { TEST_CASES } from "./test-cases";

export const activityInvestigationScenarioTask: Task<
  ActivityInvestigationScenarioParams,
  ActivityInvestigationScenarioSchema
> = {
  description:
    "Generate an investigation scenario with a mystery, possible explanations, and the correct explanation index",
  generate: generateActivityInvestigationScenario,
  id: "activity-investigation-scenario",
  name: "Activity Investigation Scenario",
  testCases: TEST_CASES,
};
