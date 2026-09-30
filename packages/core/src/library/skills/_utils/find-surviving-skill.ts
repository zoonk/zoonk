import "server-only";
import { type Skill, prisma } from "@zoonk/db";

/** Merges point at the survivor, so a chain longer than this means a merge cycle. */
const MAX_MERGE_DEPTH = 5;

/**
 * Follows `mergedIntoId` to the skill that survived a merge, so learners and
 * lessons that still point at a duplicate reach the one skill everyone shares.
 * Returns the ids visited on the way, which cached reads tag.
 */
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
