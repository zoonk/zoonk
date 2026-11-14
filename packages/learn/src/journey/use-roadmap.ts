"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { daysBetween } from "../_utils/iso-date";
import { getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";

const NEAR_ESTIMATE_DAYS = 42;

/** An estimate this far from the plan's week is said by its month: "~Jan", never a day. */
export function useIsFarEstimate() {
  const { plan } = usePlanScreen();

  return (isoDate: string): boolean =>
    daysBetween(plan.week.startDate, isoDate) > NEAR_ESTIMATE_DAYS;
}

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
  const isFar = useIsFarEstimate();
  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (targetDate) {
    return { estimate: targetDateEstimated, isoDate: targetDate, month: targetDateNamedMonth };
  }

  const { endDate } = plan.estimate;

  if (goal.kind === "exam" || !endDate) {
    return null;
  }

  return { estimate: true, isoDate: endDate, month: isFar(endDate) };
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

/** The phase's place leads; its own name follows only when it has one. */
export function useRoadmapPosition() {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const { plan } = usePlanScreen();
  const { currentIndex, phases } = useRoadmapPhases();
  const current = phases[currentIndex];

  if (!current) {
    return null;
  }

  const name = phaseName(current, { mocksRequirePlus: plan.access.mocksRequirePlus });

  return {
    name: name === phaseName(current, { byPlace: true }) ? null : name,
    phase: current,
    place: t("Phase {number, number} of {total, number}", {
      number: currentIndex + 1,
      total: phases.length,
    }),
  };
}
