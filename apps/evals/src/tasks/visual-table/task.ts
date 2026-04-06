import { type Task } from "@/lib/types";
import {
  type VisualTableParams,
  type VisualTableSchema,
  generateVisualTable,
} from "@zoonk/ai/tasks/visuals/table";
import { TEST_CASES } from "./test-cases";

export const visualTableTask: Task<VisualTableParams, VisualTableSchema> = {
  description:
    "Generate structured table data (columns, rows, optional caption) from a textual description",
  generate: generateVisualTable,
  id: "visual-table",
  name: "Visual Table",
  testCases: TEST_CASES,
};
