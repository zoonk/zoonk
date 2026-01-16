import {
  generateStepVisuals,
  type StepVisualParams,
  type StepVisualSchema,
} from "@zoonk/ai/tasks/steps/visual";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const stepVisualTask: Task<StepVisualParams, StepVisualSchema> = {
  description:
    "Generate visual resources (timelines, diagrams, quotes, code, charts, tables, images) for learning steps",
  generate: generateStepVisuals,
  id: "step-visual",
  name: "Step Visual Resources",
  testCases: TEST_CASES,
};
