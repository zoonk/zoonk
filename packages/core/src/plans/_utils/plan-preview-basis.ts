import { z } from "zod";
import { toIsoDate } from "../planner/plan-calendar";

type PreviewContext = {
  plan: { inputVersion: number; version: number };
  timeZone: string;
  today: Date;
};

export const planPreviewBasisSchema = z.object({
  inputVersion: z.int().nonnegative(),
  planVersion: z.int().nonnegative(),
  studyDay: z.iso.date(),
  timeZone: z.string(),
});

export function getPlanPreviewBasis(context: PreviewContext) {
  return {
    inputVersion: context.plan.inputVersion,
    planVersion: context.plan.version,
    studyDay: toIsoDate(context.today),
    timeZone: context.timeZone,
  };
}

/** A quote is actionable only for the inputs and local day it was computed from. */
export function isCurrentPlanPreview({
  basis,
  context,
}: {
  basis: z.infer<typeof planPreviewBasisSchema> | null;
  context: PreviewContext;
}): boolean {
  const current = getPlanPreviewBasis(context);

  return (
    basis !== null &&
    basis.inputVersion === current.inputVersion &&
    basis.planVersion === current.planVersion &&
    basis.studyDay === current.studyDay &&
    basis.timeZone === current.timeZone
  );
}
