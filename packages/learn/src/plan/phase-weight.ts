import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { daysBetween } from "../_utils/iso-date";

type DatedPhase = Pick<PlanPhaseView, "endDate" | "startDate">;
type WeighedPhase = DatedPhase & Pick<PlanPhaseView, "hours">;

/** A phase's days, its first and last both counted (the planner's `endDate` is its last day). */
function getPhaseDays(phase: DatedPhase): number | null {
  if (!phase.startDate || !phase.endDate) {
    return null;
  }

  return Math.max(1, daysBetween(phase.startDate, phase.endDate) + 1);
}

/**
 * A phase's share of a drawing of the plan: its days when it has dates, else its hours. Every
 * drawing of the phases (the Plan's roadmap, the plan's reveal) uses it, so the same plan is drawn
 * to one scale, time: a 120-day phase never draws shorter than a 15-day one because it holds
 * fewer hours of lessons.
 */
export function getPhaseWeight(phase: WeighedPhase): number {
  return getPhaseDays(phase) ?? Math.max(1, phase.hours);
}

/**
 * Where a day falls in its phase, from 0 (the start of its first day) to 1 (the end of its last),
 * for a mark drawn inside the phase's band: `at: "start"` for where the day begins (today's
 * marker), `"middle"` for an event on that day (a mock), `"end"` for one that closes it (the
 * phase's challenge). Null for a phase without dates.
 */
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

/**
 * "Day 15 of 22": the learner's day in the phase they're in, both its first and last day counted,
 * kept inside the phase. Null for a phase without dates.
 */
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
