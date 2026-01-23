import { z } from "zod";

export const chartInputSchema = z.object({
  chartType: z.enum(["bar", "line", "pie"]).describe("Chart type: bar, line, or pie"),
  data: z
    .array(
      z.object({
        name: z.string().describe("Category/x-axis label"),
        value: z.number().describe("Numeric value"),
      }),
    )
    .describe("Data points"),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
  title: z.string().describe("Chart title (max 50 chars)"),
});
