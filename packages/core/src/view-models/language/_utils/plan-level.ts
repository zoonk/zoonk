import "server-only";
import { prisma } from "@zoonk/db";
import { getPlanLevelLabel, listPlanLevels } from "../../../language/levels/plan-levels";
import { readSavedPlan } from "../../../learner/facts/saved-plan";
import { parsePlanGraph } from "../../../plans/planner/plan-state";

/** GET-only, after ownership authorization. Null while the plan has no lessons. */
export async function readPlanLevel({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<string | null> {
  const plan = await readSavedPlan(userId, goalId);

  if (!plan) {
    return null;
  }

  const graphSkills = parsePlanGraph(plan.graph).skills;

  const skillIds = new Set([
    ...graphSkills.map((skill) => skill.skillId),
    ...plan.items.flatMap((item) => (item.kind === "lesson" && item.skillId ? item.skillId : [])),
  ]);

  const skills = await prisma.skill.findMany({
    select: { cefrLevel: true, id: true, level: true },
    where: { id: { in: [...skillIds] } },
  });

  return getPlanLevelLabel(
    listPlanLevels({
      graphSkills,
      items: plan.items,
      skills: new Map(skills.map((skill) => [skill.id, skill])),
    }),
  );
}
