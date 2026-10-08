import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type GoalPlan, loadGoalPlan } from "../../../learner/_utils/goal-skill-graph";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { parsePlanGraph, parsePlanSettings } from "../../../plans/planner/plan-state";
import { findSkippableItems, findWeakestArea, getAcedSkillIds } from "../mock-adapt-rules";
import { type MockAdaptView, type MockPurpose, type MockResult } from "../mock-contract";

/** What a finished mock can change in its goal's plan, with the plan as it is now. */
export type MockPlanOffers = {
  aced: Set<string>;
  focusAreas: string[];
  plan: GoalPlan;
  view: MockAdaptView;
};

/**
 * The plan changes a finished mock offers (see `MockAdaptView`), worked out from the plan as it is
 * now, so a change already made, or a lesson done since, is never offered again. A mock taken as
 * placement offers none: its answers set where the plan starts. Null without an active goal with a
 * plan, or when the mock offers nothing.
 */
export async function loadMockPlanOffers({
  goal,
  purpose,
  result,
}: {
  goal: Goal | null;
  purpose: MockPurpose;
  result: MockResult | null;
}): Promise<MockPlanOffers | null> {
  if (!goal || goal.status !== "active" || purpose === "placement" || !result) {
    return null;
  }

  const [plan, row] = await Promise.all([
    loadGoalPlan(goal.id),
    prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId: goal.id } }),
  ]);

  if (!row) {
    return null;
  }

  const graph = parsePlanGraph(row.graph);
  const { focusAreas } = parsePlanSettings(row.settings);
  const planAreas = [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];
  const aced = getAcedSkillIds({ items: plan.items, result });
  const skippable = findSkippableItems({ aced, items: plan.items });
  const focus = findWeakestArea({ focusAreas, planAreas, result });

  const topics = result.topics
    .filter((topic) => skippable.some((item) => item.skillIds.includes(topic.skillId)))
    .map((topic) => topic.name);

  if (!focus && skippable.length === 0) {
    return null;
  }

  return {
    aced,
    focusAreas,
    plan,
    view: {
      focus: focus && { area: focus.name, correct: focus.correct, total: focus.total },
      skip: skippable.length > 0 ? { lessons: skippable.length, topics } : null,
    },
  };
}
