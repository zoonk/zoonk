import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";

/**
 * The Library's prerequisite edges between these skills: each skill's prerequisites among them.
 * Skills with none are left out.
 */
export async function loadSkillPrerequisites(
  skillIds: readonly string[],
  tx: TransactionClient = prisma,
): Promise<Map<string, string[]>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const edges = await tx.skillPrerequisite.findMany({
    select: { prerequisiteId: true, skillId: true },
    where: { prerequisiteId: { in: [...skillIds] }, skillId: { in: [...skillIds] } },
  });

  return edges.reduce((map, edge) => {
    map.set(edge.skillId, [...(map.get(edge.skillId) ?? []), edge.prerequisiteId]);
    return map;
  }, new Map<string, string[]>());
}
