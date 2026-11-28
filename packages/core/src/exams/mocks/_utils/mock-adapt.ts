import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type GoalPlan, loadGoalPlan } from "../../../learner/_utils/goal-skill-graph";
import { getWritingSkillIds } from "../../../learner/writing-skills";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { parsePlanGraph, parsePlanSettings } from "../../../plans/planner/plan-state";
import { findSkippableItems, getAcedSkillIds } from "../mock-adapt-rules";
import { type MockPurpose, type MockResult } from "../mock-contract";
import { type MockAdaptView } from "../mock-view-contract";

export type MockPlanOffers = { aced: Set<string>; plan: GoalPlan; view: MockAdaptView };

export async function loadMockPlanOffers({
  blueprint,
  goal,
  purpose,
  result,
}: {
  blueprint: ExamBlueprint | null;
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
  const { writtenSkillIds } = parsePlanSettings(row.settings);

  const written = writtenSkillIds
    ? new Set(writtenSkillIds)
    : getWritingSkillIds({
        graph,
        structure: blueprint ? readBlueprintContent(blueprint).structure : null,
      });

  const aced = getAcedSkillIds({ items: plan.items, result }).difference(written);
  const skippable = findSkippableItems({ aced, items: plan.items });

  const topics = result.topics
    .filter((topic) => skippable.some((item) => item.skillIds.includes(topic.skillId)))
    .map((topic) => topic.name);

  if (skippable.length === 0) {
    return null;
  }

  const skippedItems = await prisma.planItem.findMany({
    where: { id: { in: skippable.map((item) => item.id) } },
  });

  return { aced, plan, view: { skip: { lessons: countLessons(skippedItems), topics } } };
}
