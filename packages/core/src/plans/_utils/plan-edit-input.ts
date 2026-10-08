import { type PlanEditInput } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { getSkillArea, getWrittenTestAreas } from "../planner/graph-areas";
import { getWeekdayMinutes, toIsoDate } from "../planner/plan-calendar";
import { DAYS_PER_WEEK } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";

function getAreas(context: PlanContext): string[] {
  const { graph } = context.state;
  return [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];
}

/**
 * The plan as the plan-edit model reads it: its areas with their skills (so a focus can name part
 * of an area), its written tests, time per weekday, date and the learner's today. The request (or the routine
 * purpose) and memory are added by the caller.
 */
export function toPlanEditInput(
  context: PlanContext,
): Omit<PlanEditInput, "memory" | "purpose" | "request"> & {
  analytics: { contentScope: "personal"; distinctId: string; goalId: string };
} {
  const { goal, state } = context;

  const calendar = {
    dailyMinutes: state.goal.dailyMinutes,
    weekdayMinutes: state.settings.weekdayMinutes,
  };

  return {
    analytics: { contentScope: "personal", distinctId: goal.userId, goalId: goal.id },
    areas: getAreas(context),
    dailyMinutes: state.goal.dailyMinutes,
    goalKind: goal.kind,
    language: goal.language,
    skills: state.graph.skills.map((skill) => ({
      area: getSkillArea({ graph: state.graph, skill }),
      name: skill.name,
      skillId: skill.skillId,
    })),
    targetDate: state.goal.targetDate,
    today: toIsoDate(context.today),
    weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
      getWeekdayMinutes({ calendar, weekday }),
    ),
    writtenParts: goal.kind === "exam" ? [...getWrittenTestAreas(state.graph)] : [],
  };
}
