import { type Task } from "@/lib/types";
import {
  type StepVisualParams,
  type StepVisualSchema,
  generateStepVisuals,
} from "@zoonk/ai/tasks/steps/visual";
import { TEST_CASES } from "./test-cases";

export const stepVisualTask: Task<StepVisualParams, StepVisualSchema> = {
  description:
    "Generate visual resources (timelines, diagrams, quotes, code, charts, tables, images) for learning steps",
  generate: generateStepVisuals,
  id: "step-visual",
  name: "Step Visual Resources",
  testCases: TEST_CASES,
};
