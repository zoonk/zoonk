import { type Task } from "@/lib/types";
import {
  type VisualFormulaParams,
  type VisualFormulaSchema,
  generateVisualFormula,
} from "@zoonk/ai/tasks/visuals/formula";
import { TEST_CASES } from "./test-cases";

export const visualFormulaTask: Task<VisualFormulaParams, VisualFormulaSchema> = {
  description:
    "Generate structured formula data (LaTeX expression and plain-text description) from a textual description",
  generate: generateVisualFormula,
  id: "visual-formula",
  name: "Visual Formula",
  testCases: TEST_CASES,
};
