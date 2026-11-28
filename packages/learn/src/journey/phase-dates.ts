import { type GoalView } from "@zoonk/core/goals/contract";
import {
  type PlanPhaseView,
  type PlanView,
  type ShortPhaseView,
} from "@zoonk/core/plans/view-contract";
import { isNearEstimate } from "../_utils/iso-date";

type GoalKind = GoalView["kind"];

type DatedPhase = Pick<
  PlanPhaseView,
  | "checkpoint"
  | "endDate"
  | "index"
  | "kind"
  | "later"
  | "precision"
  | "short"
  | "startDate"
  | "state"
>;

type DatedPlan = {
  end: PlanView["end"];
  estimate: Pick<PlanView["estimate"], "endDate" | "finishReason" | "precision">;
  phases: readonly DatedPhase[];
  schedule: Pick<
    PlanView["schedule"],
    "targetDate" | "targetDateEstimated" | "targetDateNamedMonth"
  >;
  shortPlan: PlanView["shortPlan"];
  week: Pick<PlanView["week"], "startDate">;
};

export type DatePrecision = "day" | "month" | "year";

export type PlanDate = { estimate: boolean; isoDate: string; precision: DatePrecision };

/**
 * A short plan names a phase by its days ("Days 1–3"), a phase whose work has no place yet by
 * "Later", and every other phase by the day it ends.
 */
export type PhaseEnd = PlanDate | { later: true } | { short: ShortPhaseView };

/**
 * An estimate this far from the plan's week is said by its month ("~Jan"), never a day, and one
 * core dates only by its year ("~2031") by that year.
 */
function getEstimatePrecision({
  isoDate,
  plan,
  precision,
}: {
  isoDate: string;
  plan: Pick<DatedPlan, "week">;
  precision: PlanPhaseView["precision"];
}): DatePrecision {
  if (precision === "year") {
    return "year";
  }

  return isNearEstimate({ date: isoDate, today: plan.week.startDate }) ? "day" : "month";
}

/** The day of a challenge still ahead that comes on or after the phase's last lesson. */
function getEndingChallengeDay({ checkpoint, endDate }: DatedPhase): string | null {
  const challengeDay = checkpoint?.state === "upcoming" ? checkpoint.date : null;
  return challengeDay && endDate && challengeDay >= endDate ? challengeDay : null;
}

/** A last phase without a day of its own ends with the plan. */
function getEndWithPlan({ phase, plan }: { phase: DatedPhase; plan: DatedPlan }): PlanDate | null {
  const lastIndex = plan.phases.findLast((entry) => entry.kind !== "afterExam")?.index;
  const planEnd = phase.index === lastIndex ? plan.estimate.endDate : null;

  if (!planEnd) {
    return null;
  }

  return {
    estimate: true,
    isoDate: planEnd,
    precision:
      plan.estimate.precision ?? getEstimatePrecision({ isoDate: planEnd, plan, precision: null }),
  };
}

function getPhaseEndPrecision({
  estimate,
  lastDay,
  phase,
  plan,
}: {
  estimate: boolean;
  lastDay: string;
  phase: DatedPhase;
  plan: DatedPlan;
}): DatePrecision {
  if (!estimate) {
    return "day";
  }

  const finishPrecision =
    !plan.schedule.targetDate && lastDay === plan.estimate.endDate ? plan.estimate.precision : null;

  return (
    finishPrecision ??
    (phase.state === "upcoming" || phase.precision === "year"
      ? getEstimatePrecision({ isoDate: lastDay, plan, precision: phase.precision })
      : "day")
  );
}

/**
 * The one date a phase is named by, wherever it shows: when it ends. A learning phase ends when
 * its lessons and challenge are done, so its end is an estimate while it's ahead, and while it's
 * current with its challenge (which has no booked day) still to come. Any phase that ends on its
 * challenge's day is an estimate too, as that day is wherever the challenge shows, and so is every
 * phase of a plan whose own date is one, since its phases are laid out back from that date. A
 * phase behind the learner has none: its check says it.
 */
export function getPhaseEnd({
  phase,
  plan,
}: {
  phase: DatedPhase;
  plan: DatedPlan;
}): PhaseEnd | null {
  if (phase.short && plan.shortPlan) {
    return { short: phase.short };
  }

  if (phase.state === "done" || phase.state === "unfinished" || phase.state === "leftOut") {
    return null;
  }

  if (phase.later) {
    return { later: true };
  }

  const challengeDay = getEndingChallengeDay(phase);
  // A phase is behind the learner on its challenge's day, which can come after its last lesson.
  const lastDay = challengeDay ?? phase.endDate;

  if (!lastDay) {
    return getEndWithPlan({ phase, plan });
  }

  const learns = phase.kind === "learn" || phase.kind === "afterExam";
  const ahead = phase.state === "upcoming";

  const estimate =
    challengeDay !== null ||
    plan.schedule.targetDateEstimated ||
    (learns && (ahead || phase.checkpoint?.state === "upcoming"));

  return {
    estimate,
    isoDate: lastDay,
    precision: getPhaseEndPrecision({ estimate, lastDay, phase, plan }),
  };
}

/**
 * When a phase starts, beside its end in a range. A phase ahead starts where the one before it
 * ends, so its start is an estimate whenever its end is, and both ends of the range say so.
 */
export function getPhaseStart({
  end,
  phase,
}: {
  end: PlanDate;
  phase: Pick<DatedPhase, "startDate" | "state">;
}): PlanDate | null {
  if (!phase.startDate) {
    return null;
  }

  return {
    estimate: end.estimate && phase.state === "upcoming",
    isoDate: phase.startDate,
    precision: end.precision,
  };
}

/**
 * The day the plan reaches its goal: the goal's date, or the plan's own end when it has none. That
 * end comes from the learner's pace, so a paused goal has none; the goal's date, an exam's likely
 * one included, stays.
 */
export function getPlanFinish({
  goalKind,
  paused = false,
  plan,
}: {
  goalKind: GoalKind;
  paused?: boolean;
  plan: DatedPlan;
}): PlanDate | null {
  if (goalKind !== "exam" && plan.end) {
    const { finishedOn } = plan.end;
    return finishedOn ? { estimate: false, isoDate: finishedOn, precision: "day" } : null;
  }

  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (targetDate) {
    return {
      estimate: targetDateEstimated,
      isoDate: targetDate,
      precision: targetDateNamedMonth ? "month" : "day",
    };
  }

  const { endDate, precision } = plan.estimate;

  if (goalKind === "exam" || paused || !endDate) {
    return null;
  }

  return {
    estimate: true,
    isoDate: endDate,
    precision: precision ?? getEstimatePrecision({ isoDate: endDate, plan, precision: null }),
  };
}

/**
 * A plan with no date whose finish lies past the years it lays out has no finish date: its list
 * ends on "Later" and its timeline ends open.
 */
export function isPlanFinishLater({
  goalKind,
  paused = false,
  plan,
}: {
  goalKind: GoalKind;
  paused?: boolean;
  plan: DatedPlan;
}): boolean {
  return (
    goalKind !== "exam" &&
    !paused &&
    !plan.end &&
    !plan.schedule.targetDate &&
    plan.estimate.finishReason === "beyondHorizon"
  );
}

/** The phases the roadmap draws: the after-exam ones and those left out aren't on it. */
export function getRoadmapPhases<Phase extends DatedPhase>(
  phases: readonly Phase[],
  finishedOn?: string | null,
): Phase[] {
  const drawn = phases.filter((phase) => phase.kind !== "afterExam" && phase.state !== "leftOut");

  if (!finishedOn) {
    return drawn;
  }

  return drawn.map((phase) => ({
    ...phase,
    endDate: phase.endDate && phase.endDate > finishedOn ? finishedOn : phase.endDate,
    startDate: phase.startDate && phase.startDate > finishedOn ? finishedOn : phase.startDate,
  }));
}

function endKey(end: PlanDate | { short: ShortPhaseView }): string {
  return "short" in end ? `days ${end.short.firstDay}-${end.short.lastDay}` : end.isoDate;
}

/**
 * The phases whose end the timeline's axis dates, under the phase's end edge: the current one and
 * each after it, but not the last, whose place is the goal's date. A date says once where it
 * falls: when phases end on the same day only the last of them is dated, one that ends on the
 * goal's day leaves it to the goal, and any ending on the learner's today leaves it to "Today".
 */
export function getAxisDatedPhases({
  goalKind,
  plan,
  today,
}: {
  goalKind: GoalKind;
  plan: DatedPlan;
  today: string;
}): Set<number> {
  const phases = getRoadmapPhases(plan.phases);
  const currentIndex = phases.findIndex((phase) => phase.state === "current");
  const finish = getPlanFinish({ goalKind, plan });

  const dated = phases.slice(currentIndex, -1).flatMap((phase) => {
    const end = getPhaseEnd({ phase, plan });
    return end && !("later" in end) ? [{ index: phase.index, key: endKey(end) }] : [];
  });

  return new Set(
    dated
      .filter(
        (entry, position) =>
          entry.key !== dated[position + 1]?.key &&
          entry.key !== finish?.isoDate &&
          entry.key !== today,
      )
      .map((entry) => entry.index),
  );
}

/**
 * The goal's date under the axis. On the learner's today, while a phase is under way, "Today"
 * already marks that day there, so the axis doesn't date it again; the list and the finish row
 * still name it.
 */
export function getAxisFinish({
  goalKind,
  plan,
  today,
}: {
  goalKind: GoalKind;
  plan: DatedPlan;
  today: string;
}): PlanDate | null {
  const finish = getPlanFinish({ goalKind, plan });
  const underWay = getRoadmapPhases(plan.phases).some((phase) => phase.state === "current");

  return finish?.isoDate === today && underWay ? null : finish;
}
