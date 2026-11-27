import { PLAN_EPSILON } from "../planner/plan-precision";
import { type ComputedPlan } from "./replan";

type GuardedPlan = {
  built: Pick<ComputedPlan["built"], "droppedSkillIds" | "phases">;
  feasibility: Pick<ComputedPlan["feasibility"], "coveredShare">;
};

/** Coverage, the topics kept and the phase dates must be what the same re-plan gives without the mock. */
export function holdsSchedule({
  baseline,
  computed,
}: {
  baseline: GuardedPlan;
  computed: GuardedPlan;
}): boolean {
  const dropped = new Set(baseline.built.droppedSkillIds);
  const before = baseline.built.phases.map((phase) => phase.endDate);
  const after = computed.built.phases.map((phase) => phase.endDate);

  return (
    computed.feasibility.coveredShare >= baseline.feasibility.coveredShare - PLAN_EPSILON &&
    computed.built.droppedSkillIds.every((skillId) => dropped.has(skillId)) &&
    before.length === after.length &&
    before.every((endDate, index) => endDate === after[index])
  );
}
