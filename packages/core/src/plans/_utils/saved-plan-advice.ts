import { type PlanView } from "../plan-view-contract";
import { daysBetween } from "../planner/plan-calendar";
import { type PlanSettings } from "../planner/plan-state";
import { foldChangeAreas } from "./fold-part-areas";
import { toPlanBasesView } from "./plan-bases-view";
import { toShownShare } from "./plan-feasibility-view";
import { type PlanReadContext } from "./plan-read-projection";
import { type PlanSummary } from "./plan-summary";

export function readSavedFeasibility(summary: PlanSummary | null): PlanView["feasibility"] {
  const coverage = summary?.selected.coverage;
  const saved = summary?.advice.feasibility ?? null;

  if (!saved || !coverage) {
    return saved;
  }

  const coveredShare = coverage.coveredShare ?? Number(coverage.coreFits);

  return {
    ...saved,
    coreFits: coverage.coreFits,
    coveredShare: toShownShare({ coveredShare, fits: coverage.fits }),
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

/** A date that has passed leaves nothing to offer: no time covers it. */
export function readPlanOffers({
  fresh,
  partAreas,
  pastDate,
  summary,
}: {
  fresh: PlanSummary | null;
  partAreas: ReadonlyMap<string, string>;
  pastDate: boolean;
  summary: PlanSummary | null;
}): Pick<PlanView, "extraOffer" | "fitOffer" | "suggestedTime"> {
  if (pastDate) {
    return { extraOffer: null, fitOffer: null, suggestedTime: null };
  }

  const fitOffer = summary?.advice.fitOffer;
  const extraOffer = fresh?.advice.extraOffer;

  return {
    extraOffer: extraOffer ? { ...extraOffer, canApply: true } : null,
    fitOffer: fitOffer
      ? { ...foldChangeAreas({ change: fitOffer, partAreas }), canApply: fresh !== null }
      : null,
    suggestedTime: fresh?.advice.suggested ?? null,
  };
}
