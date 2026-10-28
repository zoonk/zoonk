import "server-only";
import { prisma } from "@zoonk/db";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { loadPlanContext } from "../../plans/_utils/plan-context";
import { getMinutesPerItem } from "../plan-status";

/**
 * What "Still needed" measures time with: each plan item still to do, with the minutes the planner
 * gives it at the learner's pace (the plan's average per item when it can't be planned now), and
 * the exam weight of each of the goal's skills.
 */
export async function loadStillNeededWork({
  goalId,
  now,
  timeZone,
}: {
  goalId: string;
  now: Date;
  timeZone?: string;
}) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  const context = goal ? await loadPlanContext({ goal, now, timeZone }) : null;

  if (!context) {
    return { weights: new Map<string, number | null>(), work: [] };
  }

  const plan = await readGoalPlan(context.goal.id);
  const planned = new Map(context.items.map((item) => [item.id, item.minutes]));

  const averageMinutes = getMinutesPerItem({
    estimateHours: context.plan.estimateHours,
    itemCount: context.items.length,
  });

  const graph = context.state.graph;

  return {
    weights: new Map(graph.skills.map((skill) => [skill.skillId, skill.weight])),
    work: plan.items
      .filter((item) => item.status === "todo")
      .map((item) => ({
        minutes: planned.get(item.id) ?? averageMinutes,
        skillIds: item.skillIds,
      })),
  };
}
