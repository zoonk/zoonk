"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import {
  type PlanDate,
  getAxisDatedPhases,
  getAxisFinish,
  getPlanFinish,
  getRoadmapPhases,
  isPlanFinishLater,
} from "./phase-dates";
import { getRoadmapPlace } from "./roadmap-place";

export function getLessonShare(phase: PlanPhaseView): number {
  if (phase.state === "done") {
    return 1;
  }

  return phase.lessonsTotal > 0 ? Math.min(1, phase.lessonsDone / phase.lessonsTotal) : 0;
}

export function useRoadmapPhases() {
  const { goal, plan, today } = usePlanScreen();

  const phases = getRoadmapPhases(plan.phases, goal.kind === "exam" ? null : plan.end?.finishedOn);

  const currentIndex = phases.findIndex((phase) => phase.state === "current");

  return { currentIndex, phases, today };
}

export function useRoadmapFinish(): PlanDate | null {
  const { goal, paused, plan } = usePlanScreen();
  return getPlanFinish({ goalKind: goal.kind, paused, plan });
}

/** What the flag at the plan's finish stands for: the goal's date, or with none the finish the plan works out. */
export function useFinishLabel() {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();

  if (goal.kind === "exam") {
    return t("Exam date");
  }

  return plan.schedule.targetDate
    ? t("End date")
    : t({
        description:
          "Names the day the plan works out it finishes when the learner set no end date: beside the flag in the roadmap's legend, and as the label of that date in the plan's settings.",
        message: "You finish",
      });
}

/** The finish row reads "Later" where the plan's finish lies past the years it lays out. */
export function useRoadmapFinishLater(): boolean {
  const { goal, paused, plan } = usePlanScreen();
  return isPlanFinishLater({ goalKind: goal.kind, paused, plan });
}

/** The goal's date under the timeline's axis (`getAxisFinish`). */
export function useAxisFinish(): PlanDate | null {
  const { goal, plan, today } = usePlanScreen();
  return getAxisFinish({ goalKind: goal.kind, plan, today });
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

/** Where the learner is: the row under it already names the phase. */
export function useRoadmapPosition() {
  const t = useExtracted();
  const { phases } = useRoadmapPhases();
  const place = getRoadmapPlace(phases);

  if (!place) {
    return null;
  }

  return {
    phase: place.phase,
    place: t("Phase {number, number} of {total, number}", {
      number: place.number,
      total: place.total,
    }),
  };
}
