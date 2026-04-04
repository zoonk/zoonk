import { type Task } from "@/lib/types";
import {
  type VisualDiagramParams,
  type VisualDiagramSchema,
  generateVisualDiagram,
} from "@zoonk/ai/tasks/visuals/diagram";
import { TEST_CASES } from "./test-cases";

export const visualDiagramTask: Task<VisualDiagramParams, VisualDiagramSchema> = {
  description: "Generate structured diagram data (nodes and edges) from a textual description",
  generate: generateVisualDiagram,
  id: "visual-diagram",
  name: "Visual Diagram",
  testCases: TEST_CASES,
};
