import { type Task } from "@/lib/types";
import {
  type StepVisualDescriptionsParams,
  type StepVisualDescriptionsSchema,
  generateStepVisualDescriptions,
} from "@zoonk/ai/tasks/steps/visual-descriptions";
import { TEST_CASES } from "./test-cases";

export const stepVisualTask: Task<StepVisualDescriptionsParams, StepVisualDescriptionsSchema> = {
  description:
    "Select the best visual kind for each learning step and write a description specific enough for per-kind generation tasks",
  generate: generateStepVisualDescriptions,
  id: "step-visual",
  name: "Step Visual Descriptions",
  testCases: TEST_CASES,
};
