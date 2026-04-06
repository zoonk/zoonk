import { type Task } from "@/lib/types";
import {
  type VisualChartParams,
  type VisualChartSchema,
  generateVisualChart,
} from "@zoonk/ai/tasks/visuals/chart";
import { TEST_CASES } from "./test-cases";

export const visualChartTask: Task<VisualChartParams, VisualChartSchema> = {
  description:
    "Generate structured chart data (chartType, data points, title) from a textual description",
  generate: generateVisualChart,
  id: "visual-chart",
  name: "Visual Chart",
  testCases: TEST_CASES,
};
