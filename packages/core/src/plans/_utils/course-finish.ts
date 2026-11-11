import { toIsoDate } from "../planner/plan-calendar";
import { hasCompleteSkillCoverage } from "../planner/skill-minutes";
import { type ComputedPlan } from "./replan";

/**
 * When the plan finishes its whole course, the one date a language aim is reached by: null for a
 * plan with a date, which ends on it whatever it covers, and for a course that doesn't fit in the
 * days a plan lays out, whose last day finishes nothing.
 */
export function getCourseFinish(computed: Pick<ComputedPlan, "built" | "state">): string | null {
  const end = computed.built.estimate.endDate;

  return computed.state.goal.targetDate === null &&
    end &&
    hasCompleteSkillCoverage(computed.built.skillMinutes)
    ? toIsoDate(end)
    : null;
}
