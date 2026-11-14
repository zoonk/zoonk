import { type PlanChangeQuote } from "../plan-decision-contract";
import { toIsoDate } from "../planner/plan-calendar";

type PreviewContext = { plan: { version: number }; timeZone: string; today: Date };

export function getPlanPreviewBasis(context: PreviewContext): PlanChangeQuote {
  return {
    planVersion: context.plan.version,
    studyDay: toIsoDate(context.today),
    timeZone: context.timeZone,
  };
}

/** Two quotes are one when both are missing or they name the same plan version, day and zone. */
export function isSameQuote(a: PlanChangeQuote | null, b: PlanChangeQuote | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return a.planVersion === b.planVersion && a.studyDay === b.studyDay && a.timeZone === b.timeZone;
}

export function isCurrentPlanPreview({
  basis,
  context,
}: {
  basis: PlanChangeQuote | null;
  context: PreviewContext;
}): boolean {
  return basis !== null && isSameQuote(basis, getPlanPreviewBasis(context));
}
