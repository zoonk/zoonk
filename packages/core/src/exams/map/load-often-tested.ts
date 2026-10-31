import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { topicFrequencySchema } from "../../library/exams/blueprint-contract";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getOftenTestedSkillIds } from "./often-tested";

export async function loadOftenTestedSkillIds(
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind" | "userId"> | null,
): Promise<Set<string>> {
  if (!goal || goal.kind !== "exam" || !goal.examBlueprintId) {
    return new Set();
  }

  const [blueprint, plan] = await Promise.all([
    prisma.examBlueprint.findUnique({
      select: { topicFrequency: true },
      where: { id: goal.examBlueprintId },
    }),
    readSavedPlan(goal.userId, goal.id),
  ]);

  return getOftenTestedSkillIds({
    frequency: topicFrequencySchema.safeParse(blueprint?.topicFrequency).data ?? [],
    skills: parsePlanGraph(plan?.graph).skills,
  });
}
