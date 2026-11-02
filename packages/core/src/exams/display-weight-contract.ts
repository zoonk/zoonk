import { z } from "zod";

export const displayWeightSchema = z
  .object({
    basis: z.enum(["stated", "assumed"]),
    percent: z.int().min(0).max(100),
    share: z.number().min(0).max(1),
  })
  .nullable()
  .describe(
    "Normalized display weight among every notice subject, including written subjects not yet taught. Missing stated shares use the average stated subject. All whole percentages sum to 100; assumed weights must be identified as estimates. Null for plan modules or a notice with no positive weight. Original share and planner weights are unchanged.",
  );
