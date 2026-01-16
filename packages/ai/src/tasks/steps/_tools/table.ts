import { z } from "zod";

export const tableInputSchema = z.object({
  caption: z.string().optional().describe("Optional caption (max 100 chars)"),
  columns: z.array(z.string()).describe("Column headers"),
  rows: z.array(z.array(z.string())).describe("Data rows"),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
});
