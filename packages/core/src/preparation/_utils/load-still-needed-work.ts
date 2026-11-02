import "server-only";
import { type Goal } from "@zoonk/db";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getMinutesPerItem } from "../plan-status";

/** GETs only, after ownership authorization. */
export async function loadStillNeededWork(goal: Pick<Goal, "id" | "userId">) {
  const [saved, plan] = await Promise.all([
    readSavedPlan(goal.userId, goal.id),
    readGoalPlan(goal.id),
  ]);

  if (!saved) {
    return { weights: new Map<string, number | null>(), work: [] };
  }

  const planned = new Map(saved.items.map((item) => [item.id, item.minutes]));

  const averageMinutes = getMinutesPerItem({
    estimateHours: saved.estimateHours,
    itemCount: saved.items.length,
  });

  return {
    weights: new Map(
      parsePlanGraph(saved.graph).skills.map((skill) => [skill.skillId, skill.weight]),
    ),
    work: plan.items
      .filter((item) => item.status === "todo")
      .map((item) => ({
        minutes: planned.get(item.id) ?? averageMinutes,
        skillIds: item.skillIds,
      })),
  };
}
