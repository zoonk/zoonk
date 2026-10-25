"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { daysBetween } from "../_utils/iso-date";
import { getPhaseDay, getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";

/** An estimate this close says its day, not its month: "~October" read oddly in October. */
const NEAR_ESTIMATE_DAYS = 42;

/** How far into a phase its lessons are: a done one is full, the current one fills as they're done. */
export function getLessonShare(phase: PlanPhaseView): number {
  if (phase.state === "done") {
    return 1;
  }

  return phase.lessonsTotal > 0 ? Math.min(1, phase.lessonsDone / phase.lessonsTotal) : 0;
}

/**
 * The phases a drawing of the plan shows, and counts, the learner's today as the view models write
 * days, and the phase they're in. Studying after an exam comes past its finish, and a phase the
 * plan holds nothing of (`leftOut`) has no days in it, so both are on the path only.
 */
export function useRoadmapPhases() {
  const { plan, today } = usePlanScreen();

  const phases = plan.phases.filter(
    (phase) => phase.kind !== "afterExam" && phase.state !== "leftOut",
  );

  const currentIndex = phases.findIndex((phase) => phase.state === "current");

  return { currentIndex, phases, today };
}

/**
 * The end of the plan's road: the goal's date (an estimated day, or the month the learner named),
 * or when a plan without one ends at this pace, an estimate. Null for an exam without a date: its
 * day isn't known, and the plan's end isn't it.
 */
export function useRoadmapFinish(): { estimate: boolean; isoDate: string; month: boolean } | null {
  const { goal, plan } = usePlanScreen();
  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (targetDate) {
    return { estimate: targetDateEstimated, isoDate: targetDate, month: targetDateNamedMonth };
  }

  const { endDate } = plan.estimate;

  if (goal.kind === "exam" || !endDate) {
    return null;
  }

  return {
    estimate: true,
    isoDate: endDate,
    month: daysBetween(plan.week.startDate, endDate) > NEAR_ESTIMATE_DAYS,
  };
}

/**
 * Where the goal's date falls on the road when the plan runs past it (a plan that no longer fits,
 * until the learner adjusts it): the phase it falls in and how far into it. The road then keeps
 * its own end, so its days read in order and show how far past the date the plan goes. Null while
 * the road ends at the goal's date, as a plan that fits does.
 */
export function useRoadmapOverrun(): { phaseIndex: number; share: number } | null {
  const finish = useRoadmapFinish();
  const { phases } = useRoadmapPhases();
  const end = phases.at(-1)?.endDate;

  if (!finish || !end || end <= finish.isoDate) {
    return null;
  }

  const phase = phases.find(({ endDate }) => endDate !== null && endDate >= finish.isoDate);
  const share = phase ? getShareInPhase({ at: "end", date: finish.isoDate, phase }) : null;

  return phase && share !== null ? { phaseIndex: phase.index, share } : null;
}

/**
 * Where the learner is, in words: "Foundations", then "day 15 of 22" and "phase 1 of 4". A
 * language's phase holds several units, each with its page, so it's a phase there too. Null when
 * no phase is current (the plan is over).
 */
export function useRoadmapPosition() {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const { plan } = usePlanScreen();
  const { currentIndex, phases, today } = useRoadmapPhases();
  const current = phases[currentIndex];

  if (!current) {
    return null;
  }

  const day = getPhaseDay({ phase: current, today });
  const number = currentIndex + 1;
  const total = phases.length;

  return {
    day: day && t("day {day, number} of {days, number}", day),
    name: phaseName(current, { mocksRequirePlus: plan.access.mocksRequirePlus }),
    number,
    place: t("phase {number, number} of {total, number}", { number, total }),
    total,
  };
}
