import { MAX_SUGGESTED_DAILY_MINUTES } from "../daily-minutes";
import { type SuggestedDailyTime } from "../plan-view-contract";
import { type MostCoverage } from "../planner/most-coverage";
import { type PlanFeasibility, type TimeCoverage } from "../planner/plan-feasibility";
import { type PlanSuggestedTime } from "../time-advice-contract";
import { type ShownFeasibility, toShownShare } from "./plan-feasibility-view";

function getSuggestedMinutes({
  everything,
  most,
}: {
  everything: number | null;
  most: MostCoverage | null;
}): SuggestedDailyTime {
  if (everything !== null && everything <= MAX_SUGGESTED_DAILY_MINUTES) {
    return { kind: "everything", minutes: everything };
  }

  return {
    kind: "focus",
    minutes: Math.min(most?.minutes ?? MAX_SUGGESTED_DAILY_MINUTES, MAX_SUGGESTED_DAILY_MINUTES),
  };
}

export function getSuggestedTime({
  coverageAt,
  everything,
  most,
}: {
  coverageAt: (minutes: number) => TimeCoverage;
  everything: number | null;
  most: MostCoverage | null;
}): Omit<PlanSuggestedTime, "split"> {
  const suggested = getSuggestedMinutes({ everything, most });

  if (suggested.kind === "everything") {
    return { ...suggested, coveredShare: 1, everyTopic: true };
  }

  const { coreFits, coveredShare } = coverageAt(suggested.minutes);

  return {
    ...suggested,
    coveredShare: toShownShare({ coveredShare, fits: false }),
    everyTopic: coreFits,
  };
}

/**
 * The time the plan suggests while the learner's own time is below it. Finding it plans the goal
 * at each daily time, so only a plan that falls short of its date below four hours a day looks:
 * at four hours or more, or once the learner's time covers everything, nothing is suggested.
 */
export function getPlanSuggestion({
  dailyMinutes,
  feasibility,
  pastDate,
  shown,
}: {
  dailyMinutes: number;
  feasibility: Pick<PlanFeasibility, "most" | "recommendedMinutes">;
  pastDate: boolean;
  shown: Pick<ShownFeasibility, "deadline" | "fits" | "timeCovers">;
}): SuggestedDailyTime | null {
  const short = shown.deadline !== null && !shown.fits && !shown.timeCovers;

  if (pastDate || !short || dailyMinutes >= MAX_SUGGESTED_DAILY_MINUTES) {
    return null;
  }

  const suggested = getSuggestedMinutes({
    everything: feasibility.recommendedMinutes,
    most: feasibility.most,
  });

  return suggested.minutes > dailyMinutes ? suggested : null;
}
