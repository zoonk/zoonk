import { type GoalView } from "@zoonk/core/goals/contract";
import {
  type PlanPhaseView,
  type PlanView,
  type ShortPhaseView,
} from "@zoonk/core/plans/view-contract";
import { daysBetween } from "../_utils/iso-date";

const NEAR_ESTIMATE_DAYS = 42;

type GoalKind = GoalView["kind"];

type DatedPhase = Pick<
  PlanPhaseView,
  "checkpoint" | "endDate" | "index" | "kind" | "short" | "state"
>;

type DatedPlan = {
  estimate: Pick<PlanView["estimate"], "endDate">;
  phases: readonly DatedPhase[];
  schedule: Pick<
    PlanView["schedule"],
    "targetDate" | "targetDateEstimated" | "targetDateNamedMonth"
  >;
  shortPlan: PlanView["shortPlan"];
  week: Pick<PlanView["week"], "startDate">;
};

export type PlanDate = { estimate: boolean; isoDate: string; month: boolean };

/** A short plan names a phase by its days ("Days 1–3"); every other phase by the day it ends. */
export type PhaseEnd = PlanDate | { short: ShortPhaseView };

/** An estimate this far from the plan's week is said by its month: "~Jan", never a day. */
export function isFarEstimate(plan: Pick<DatedPlan, "week">, isoDate: string): boolean {
  return daysBetween(plan.week.startDate, isoDate) > NEAR_ESTIMATE_DAYS;
}

/** A phase is behind the learner on its challenge's day, which can come after its last lesson. */
function getPhaseLastDay({ checkpoint, endDate }: DatedPhase): string | null {
  const challengeDay = checkpoint?.state === "upcoming" ? checkpoint.date : null;
  return challengeDay && endDate && challengeDay > endDate ? challengeDay : endDate;
}

/**
 * The one date a phase is named by, wherever it shows: when it ends. A learning phase ends when
 * its lessons and challenge are done, so its end is an estimate while it's ahead, and while it's
 * current with its challenge (which has no booked day) still to come. A phase behind the learner
 * has none: its check says it.
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

  const lastDay = getPhaseLastDay(phase);

  if (!lastDay) {
    // A last phase without a day of its own ends with the plan.
    const lastIndex = plan.phases.findLast((entry) => entry.kind !== "afterExam")?.index;
    const planEnd = phase.index === lastIndex ? plan.estimate.endDate : null;

    return planEnd
      ? { estimate: true, isoDate: planEnd, month: isFarEstimate(plan, planEnd) }
      : null;
  }

  const learns = phase.kind === "learn" || phase.kind === "afterExam";
  const ahead = phase.state === "upcoming";
  const estimate = learns && (ahead || phase.checkpoint?.state === "upcoming");

  return { estimate, isoDate: lastDay, month: estimate && ahead && isFarEstimate(plan, lastDay) };
}

/** The day the plan reaches its goal: the goal's date, or the plan's own end when it has none. */
export function getRoadmapFinish({
  goalKind,
  plan,
}: {
  goalKind: GoalKind;
  plan: DatedPlan;
}): PlanDate | null {
  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (targetDate) {
    return { estimate: targetDateEstimated, isoDate: targetDate, month: targetDateNamedMonth };
  }

  const { endDate } = plan.estimate;

  if (goalKind === "exam" || !endDate) {
    return null;
  }

  return { estimate: true, isoDate: endDate, month: isFarEstimate(plan, endDate) };
}

/** The phases the roadmap draws: the after-exam ones and those left out aren't on it. */
export function getRoadmapPhases<Phase extends DatedPhase>(phases: readonly Phase[]): Phase[] {
  return phases.filter((phase) => phase.kind !== "afterExam" && phase.state !== "leftOut");
}

function endKey(end: PhaseEnd): string {
  return "short" in end ? `days ${end.short.firstDay}-${end.short.lastDay}` : end.isoDate;
}

/**
 * The phases whose end the timeline's axis dates, under the phase's end edge: the current one and
 * each after it, but not the last, whose place is the goal's date. A date says once where it
 * falls: when phases end on the same day only the last of them is dated, one that ends on the
 * goal's day leaves it to the goal, and the current one ending today leaves it to "Today".
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
  const finish = getRoadmapFinish({ goalKind, plan });

  if (currentIndex === -1) {
    return new Set();
  }

  const dated = phases.slice(currentIndex, -1).flatMap((phase) => {
    const end = getPhaseEnd({ phase, plan });
    return end ? [{ index: phase.index, key: endKey(end), today: phase.state === "current" }] : [];
  });

  return new Set(
    dated
      .filter(
        (entry, position) =>
          entry.key !== dated[position + 1]?.key &&
          entry.key !== finish?.isoDate &&
          !(entry.today && entry.key === today),
      )
      .map((entry) => entry.index),
  );
}
