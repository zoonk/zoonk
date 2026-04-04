import { type Task } from "@/lib/types";
import {
  type VisualCodeParams,
  type VisualCodeSchema,
  generateVisualCode,
} from "@zoonk/ai/tasks/visuals/code";
import { TEST_CASES } from "./test-cases";

export const visualCodeTask: Task<VisualCodeParams, VisualCodeSchema> = {
  description:
    "Generate structured code snippet data (code, programming language, annotations) from a textual description",
  generate: generateVisualCode,
  id: "visual-code",
  name: "Visual Code",
  testCases: TEST_CASES,
};
