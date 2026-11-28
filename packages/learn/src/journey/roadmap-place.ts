import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";

/**
 * Where the learner is among the phases the roadmap draws. One phase is the whole plan, so it has
 * no place to name.
 */
export function getRoadmapPlace<Phase extends Pick<PlanPhaseView, "state">>(
  phases: readonly Phase[],
): { number: number; phase: Phase; total: number } | null {
  const index = phases.findIndex((phase) => phase.state === "current");
  const phase = phases[index];

  return phase && phases.length > 1 ? { number: index + 1, phase, total: phases.length } : null;
}
