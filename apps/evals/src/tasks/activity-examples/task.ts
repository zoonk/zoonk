import {
  type ActivityExamplesParams,
  type ActivityExamplesSchema,
  generateActivityExamples,
} from "@zoonk/ai/tasks/activities/core/examples";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activityExamplesTask: Task<
  ActivityExamplesParams,
  ActivityExamplesSchema
> = {
  description:
    "Generate an examples activity showing where a topic appears in real-world contexts",
  generate: generateActivityExamples,
  id: "activity-examples",
  name: "Activity Examples",
  testCases: TEST_CASES,
};
