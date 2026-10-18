import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { topicFrequencySchema } from "../../library/exams/blueprint-contract";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getOftenTestedSkillIds } from "./often-tested";

/** An exam goal's "often tested" skills, from its board's past papers; empty for other goals. */
export async function loadOftenTestedSkillIds(
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind"> | null,
): Promise<Set<string>> {
  if (!goal || goal.kind !== "exam" || !goal.examBlueprintId) {
    return new Set();
  }

  const [blueprint, plan] = await Promise.all([
    prisma.examBlueprint.findUnique({
      select: { topicFrequency: true },
      where: { id: goal.examBlueprintId },
    }),
    prisma.plan.findUnique({ select: { graph: true }, where: { goalId: goal.id } }),
  ]);

  return getOftenTestedSkillIds({
    frequency: topicFrequencySchema.safeParse(blueprint?.topicFrequency).data ?? [],
    skills: parsePlanGraph(plan?.graph).skills,
  });
}
