import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { daysBetween } from "../_utils/iso-date";

type DatedPhase = Pick<PlanPhaseView, "endDate" | "startDate">;
type WeighedPhase = DatedPhase & Pick<PlanPhaseView, "hours">;

/** Both its first and last day count: the planner's `endDate` is its last day. */
function getPhaseDays(phase: DatedPhase): number | null {
  if (!phase.startDate || !phase.endDate) {
    return null;
  }

  return Math.max(1, daysBetween(phase.startDate, phase.endDate) + 1);
}

/** Days when it has dates, else hours, so every drawing of the phases shares one scale: time. */
export function getPhaseWeight(phase: WeighedPhase): number {
  return getPhaseDays(phase) ?? Math.max(1, phase.hours);
}

/** 0 is the start of the phase's first day and 1 the end of its last; null without dates. */
export function getShareInPhase({
  at,
  date,
  phase,
}: {
  at: "end" | "middle" | "start";
  date: string;
  phase: DatedPhase;
}): number | null {
  const days = getPhaseDays(phase);

  if (days === null || !phase.startDate) {
    return null;
  }

  const offset = { end: 1, middle: 0.5, start: 0 }[at];
  return Math.min(1, Math.max(0, (daysBetween(phase.startDate, date) + offset) / days));
}

export function getPhaseDay({
  phase,
  today,
}: {
  phase: DatedPhase;
  today: string;
}): { day: number; days: number } | null {
  const days = getPhaseDays(phase);

  if (days === null || !phase.startDate) {
    return null;
  }

  return { day: Math.min(days, Math.max(1, daysBetween(phase.startDate, today) + 1)), days };
}
