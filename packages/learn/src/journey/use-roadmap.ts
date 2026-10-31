"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { daysBetween } from "../_utils/iso-date";
import { getPhaseDay, getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";

const NEAR_ESTIMATE_DAYS = 42;

export function getLessonShare(phase: PlanPhaseView): number {
  if (phase.state === "done") {
    return 1;
  }

  return phase.lessonsTotal > 0 ? Math.min(1, phase.lessonsDone / phase.lessonsTotal) : 0;
}

export function useRoadmapPhases() {
  const { plan, today } = usePlanScreen();

  const phases = plan.phases.filter(
    (phase) => phase.kind !== "afterExam" && phase.state !== "leftOut",
  );

  const currentIndex = phases.findIndex((phase) => phase.state === "current");

  return { currentIndex, phases, today };
}

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
