import "server-only";
import { prisma } from "@zoonk/db";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { isPlanReady } from "../../plans/_utils/apply-plan-change";
import { loadPlanContext } from "../../plans/_utils/plan-context";
import { computePlan } from "../../plans/_utils/replan";
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

  const [plan, computed] = await Promise.all([
    loadGoalPlan(context.goal.id),
    isPlanReady(context) ? computePlan({ context, mode: "automatic", now, pace: "saved" }) : null,
  ]);

  const planned = new Map(
    (computed?.built.items ?? []).flatMap((item) => (item.id ? [[item.id, item.minutes]] : [])),
  );

  const averageMinutes = getMinutesPerItem({
    estimateHours: context.plan.estimateHours,
    itemCount: context.items.length,
  });

  const graph = computed?.state.graph ?? context.state.graph;

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
