"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";
import {
  type PlanDate,
  getAxisDatedPhases,
  getRoadmapFinish,
  getRoadmapPhases,
} from "./phase-dates";

export function getLessonShare(phase: PlanPhaseView): number {
  if (phase.state === "done") {
    return 1;
  }

  return phase.lessonsTotal > 0 ? Math.min(1, phase.lessonsDone / phase.lessonsTotal) : 0;
}

export function useRoadmapPhases() {
  const { plan, today } = usePlanScreen();

  const phases = getRoadmapPhases(plan.phases);

  const currentIndex = phases.findIndex((phase) => phase.state === "current");

  return { currentIndex, phases, today };
}

export function useRoadmapFinish(): PlanDate | null {
  const { goal, plan } = usePlanScreen();
  return getRoadmapFinish({ goalKind: goal.kind, plan });
}

/** The phases whose end the timeline's axis dates (`getAxisDatedPhases`). */
export function useAxisDatedPhases(): Set<number> {
  const { goal, plan, today } = usePlanScreen();
  return getAxisDatedPhases({ goalKind: goal.kind, plan, today });
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
