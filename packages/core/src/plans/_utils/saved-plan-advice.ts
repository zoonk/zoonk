import { type PlanView } from "../plan-view-contract";
import { daysBetween } from "../planner/plan-calendar";
import { type PlanSettings } from "../planner/plan-state";
import { toPlanBasesView } from "./plan-bases-view";
import { toShownCoverage } from "./plan-feasibility-view";
import { type PlanReadContext } from "./plan-read-projection";
import { type PlanSummary } from "./plan-summary";

export function readSavedFeasibility(summary: PlanSummary | null): PlanView["feasibility"] {
  const coverage = summary?.selected.coverage;
  const saved = summary?.advice.feasibility ?? null;

  if (!saved || !coverage) {
    return saved;
  }

  const coveredShare = coverage.coveredShare ?? Number(coverage.coreFits);
  const { reachedShare } = coverage;

  return {
    ...saved,
    coreFits: coverage.coreFits,
    ...toShownCoverage({
      ...coverage,
      coveredShare,
      // Reach is measured when the plan is built; lessons done since only add depth.
      reachedShare: reachedShare === null ? null : Math.max(reachedShare, coveredShare),
    }),
    fits: coverage.fits,
    timeCovers: coverage.fits || saved.timeCovers,
  };
}

export function readSavedBases({
  summary,
  settings,
  context,
}: {
  context: PlanReadContext;
  summary: PlanSummary | null;
  settings: PlanSettings;
}): PlanView["bases"] {
  const bases = summary?.selected.bases;

  return bases
    ? toPlanBasesView({
        bases: {
          ...bases,
          bases: bases.bases.map((base) => ({
            ...base,
            minutes: { ...base.minutes, quick: base.minutes.quick ?? 0 },
          })),
          daysLeft: context.goal.targetDate
            ? daysBetween(context.today, context.goal.targetDate)
            : null,
        },
        settings,
      })
    : null;
}
