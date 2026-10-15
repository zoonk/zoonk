import { z } from "zod";
import { selectedSummarySchema } from "./selected-summary-contract";

const planSummaryBasisSchema = z
  .object({
    inputVersion: z.int().nonnegative(),
    planId: z.string(),
    planVersion: z.int().positive(),
    studyDay: z.iso.date(),
    timeZone: z.string().min(1),
    userId: z.string(),
  })
  .strict();

/** A legacy or unrecognized summary is stale; it never means a zero-work plan. */
export const savedPlanSummarySchema = z
  .object({
    basis: planSummaryBasisSchema,
    schemaVersion: z.literal(1),
    selected: selectedSummarySchema,
  })
  .strict();

export type PlanSummaryBasis = z.infer<typeof planSummaryBasisSchema>;
export type SavedPlanSummary = z.infer<typeof savedPlanSummarySchema>;

/** The authorized reader's complete basis must match before it may skip a selected build. */
export function readFreshPlanSummary({
  basis,
  value,
}: {
  basis: PlanSummaryBasis;
  value: unknown;
}): SavedPlanSummary | null {
  const parsed = savedPlanSummarySchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const saved = parsed.data.basis;

  return saved.userId === basis.userId &&
    saved.planId === basis.planId &&
    saved.inputVersion === basis.inputVersion &&
    saved.planVersion === basis.planVersion &&
    saved.studyDay === basis.studyDay &&
    saved.timeZone === basis.timeZone
    ? parsed.data
    : null;
}
