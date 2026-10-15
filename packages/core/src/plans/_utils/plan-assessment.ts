import { type Goal, type PlanAdaptationReason } from "@zoonk/db";
import {
  type PlanStatusItem,
  getMinutesPerItem,
  getPlanAdjustments,
  getPlanLifecycle,
  getPlanPace,
  hasWorkAfterDate,
} from "../../preparation/plan-status";
import { type FitCoverage, type PlanAssessment, type PlanFit } from "../plan-assessment-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanSummary } from "./plan-summary";

/** What the pace reads beside the plan's items (see `getPlanPace`). */
type PaceFacts = {
  /** Lessons earlier days left that aren't done yet (see `loadCatchUpItems`). */
  catchUp: number;
  estimateHours: number | null;
  /** A free exam plan past its first week: only Plus moves it (see `ExamPrepAccess.trialEnded`). */
  freeWeekOver: boolean;
  phaseChallengesRequired: boolean;
  /** The learner chose to go on after the date (an exam's "Study everything"). */
  studiesPastTarget: boolean;
};

function toFitCoverage(coverage: NonNullable<PlanSummary["selected"]["coverage"]>): FitCoverage {
  return {
    coreFits: coverage.coreFits,
    coveredShare: coverage.coveredShare,
    deadline: coverage.deadline,
    measure: coverage.measure,
  };
}

/**
 * Whether the stored plan reaches the goal by its date (see `PlanFit`): its summary's verdict
 * while the goal's date is the one it measured, and no work after the date either way. Work still
 * to do after the date is a definite "doesn't fit" whatever else is known; numbers of another date,
 * or none at all, are pending. A plan that may not reflect its inputs yet never reads as fitting.
 */
function readFit({
  pending,
  summary,
  targetDate,
  workAfterDate,
}: {
  pending: boolean;
  summary: PlanSummary | null;
  targetDate: Date | null;
  workAfterDate: boolean;
}): PlanFit {
  if (!targetDate) {
    return { verdict: "noDeadline" };
  }

  const measured = summary?.selected.coverage ?? null;
  const coverage = measured && toFitCoverage(measured);
  const options = getPlanAdjustments(targetDate);

  if (workAfterDate) {
    return { coverage, evidence: "workAfterDate", options, verdict: "doesNotFit" };
  }

  if (!measured || !coverage || measured.targetDate !== toIsoDate(targetDate)) {
    return { coverage, verdict: "pending" };
  }

  if (!measured.fits) {
    return { coverage, evidence: "coverage", options, verdict: "doesNotFit" };
  }

  return pending ? { coverage, verdict: "pending" } : { coverage, verdict: "fits" };
}

/**
 * Where a stored plan stands (see `PlanAssessment`), read from what's stored and the learner's day,
 * without planning anything: its fit from the summary its layout posted (see `readFit`), its pace
 * and lifecycle from its items, what it may not reflect yet, and the layout its numbers are as of.
 */
export function readPlanAssessment({
  day,
  goal,
  items,
  pace,
  pendingAdaptation,
  summary,
}: {
  /** The learner-local date, as a UTC-midnight label like `scheduledFor`. */
  day: Date;
  goal: { kind: Goal["kind"]; targetDate: Date | null };
  items: readonly PlanStatusItem[];
  pace: PaceFacts;
  pendingAdaptation: readonly PlanAdaptationReason[];
  /** The plan's summary when it describes the stored plan (see `readPlanSummary`). */
  summary: PlanSummary | null;
}): PlanAssessment {
  const { phaseChallengesRequired, studiesPastTarget } = pace;
  const { targetDate } = goal;

  const pending =
    summary === null || pendingAdaptation.length > 0
      ? { legacy: summary === null, reasons: [...pendingAdaptation] }
      : null;

  return {
    asOf: summary && {
      layoutStudyDay: summary.basis.layoutStudyDay,
      planVersion: summary.basis.planVersion,
    },
    fit: readFit({
      pending: pending !== null,
      summary,
      targetDate,
      workAfterDate: hasWorkAfterDate({
        items,
        phaseChallengesRequired,
        studiesPastTarget,
        targetDate,
      }),
    }),
    lifecycle: getPlanLifecycle({
      freeWeekOver: pace.freeWeekOver,
      goalKind: goal.kind,
      items,
      phaseChallengesRequired,
      studiesPastTarget,
      targetDate,
      today: day,
    }),
    pace: getPlanPace({
      catchUp: pace.catchUp,
      freeWeekOver: pace.freeWeekOver,
      items,
      minutesPerItem: getMinutesPerItem({
        estimateHours: pace.estimateHours,
        itemCount: items.length,
      }),
      phaseChallengesRequired,
      targetDate,
      today: day,
    }),
    pending,
  };
}
