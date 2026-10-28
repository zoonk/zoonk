import { z } from "zod";
import { toIsoDate } from "../planner/plan-calendar";

type PreviewContext = { plan: { version: number }; timeZone: string; today: Date };

export const planPreviewBasisSchema = z.object({
  planVersion: z.int().nonnegative(),
  studyDay: z.iso.date(),
  timeZone: z.string(),
});

export function getPlanPreviewBasis(context: PreviewContext) {
  return {
    planVersion: context.plan.version,
    studyDay: toIsoDate(context.today),
    timeZone: context.timeZone,
  };
}

/** A quote is actionable only for the saved plan, local day and zone it was computed from. */
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
    basis.planVersion === current.planVersion &&
    basis.studyDay === current.studyDay &&
    basis.timeZone === current.timeZone
  );
}
