import { type Task } from "@/lib/types";
import {
  type ActivityExamplesParams,
  type ActivityExamplesSchema,
  generateActivityExamples,
} from "@zoonk/ai/tasks/activities/core/examples";
import { TEST_CASES } from "./test-cases";

export const activityExamplesTask: Task<ActivityExamplesParams, ActivityExamplesSchema> = {
  description:
    "Generate an examples activity showing how a topic works through practical demonstrations and real-world contexts",
  generate: generateActivityExamples,
  id: "activity-examples",
  name: "Activity Examples",
  testCases: TEST_CASES,
};
