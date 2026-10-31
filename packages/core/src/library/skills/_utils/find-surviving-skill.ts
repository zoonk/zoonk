import "server-only";
import { type Skill, prisma } from "@zoonk/db";

const MAX_MERGE_DEPTH = 5;

export async function findSurvivingSkill(
  skillId: string,
  visitedIds: readonly string[] = [],
): Promise<{ skill: Skill; visitedIds: string[] } | null> {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });

  if (!skill) {
    return null;
  }

  const path = [...visitedIds, skill.id];

  if (!skill.mergedIntoId || path.length > MAX_MERGE_DEPTH) {
    return { skill, visitedIds: path };
  }

  return findSurvivingSkill(skill.mergedIntoId, path);
}
