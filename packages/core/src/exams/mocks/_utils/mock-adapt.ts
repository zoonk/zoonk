import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type GoalPlan, loadGoalPlan } from "../../../learner/_utils/goal-skill-graph";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { parsePlanGraph, parsePlanSettings } from "../../../plans/planner/plan-state";
import { findSkippableItems, findWeakestArea, getAcedSkillIds } from "../mock-adapt-rules";
import { type MockPurpose, type MockResult } from "../mock-contract";
import { type MockAdaptView } from "../mock-view-contract";

export type MockPlanOffers = {
  aced: Set<string>;
  focusAreas: string[];
  plan: GoalPlan;
  view: MockAdaptView;
};

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

  const skippedItems = await prisma.planItem.findMany({
    where: { id: { in: skippable.map((item) => item.id) } },
  });

  return {
    aced,
    focusAreas,
    plan,
    view: {
      focus: focus && { area: focus.name, correct: focus.correct, total: focus.total },
      skip: skippable.length > 0 ? { lessons: countLessons(skippedItems), topics } : null,
    },
  };
}
