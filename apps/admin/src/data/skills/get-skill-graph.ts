import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type Skill, prisma } from "@zoonk/db";

/** Deep enough to see where a skill starts, shallow enough to stay readable. */
export const MAX_PREREQUISITE_DEPTH = 4;

/** Upper bound on skills per side of the graph, so a hub skill can't render hundreds of nodes. */
export const MAX_GRAPH_SKILLS = 60;

const graphSkillSelect = { id: true, level: true, mergedIntoId: true, name: true } as const;

export type GraphSkill = Pick<Skill, "id" | "level" | "mergedIntoId" | "name">;

/**
 * Keeps the first occurrence of each skill that isn't already on the graph, up
 * to the remaining capacity. A skill reachable by two paths shows once, at the
 * depth where it first appears.
 */
function selectNewSkills({
  capacity,
  candidates,
  seenIds,
}: {
  capacity: number;
  candidates: GraphSkill[];
  seenIds: Set<string>;
}): GraphSkill[] {
  const unique = [...new Map(candidates.map((skill) => [skill.id, skill])).values()];
  return unique.filter((skill) => !seenIds.has(skill.id)).slice(0, capacity);
}

/**
 * Walks prerequisites one layer per query. Each returned layer is one step
 * further from the skill: the first holds its direct prerequisites.
 */
async function walkPrerequisites({
  depth,
  frontierIds,
  seenIds,
}: {
  depth: number;
  frontierIds: string[];
  seenIds: Set<string>;
}): Promise<GraphSkill[][]> {
  const capacity = MAX_GRAPH_SKILLS - (seenIds.size - 1);

  if (depth > MAX_PREREQUISITE_DEPTH || frontierIds.length === 0 || capacity <= 0) {
    return [];
  }

  const edges = await prisma.skillPrerequisite.findMany({
    orderBy: { prerequisite: { name: "asc" } },
    select: { prerequisite: { select: graphSkillSelect } },
    where: { skillId: { in: frontierIds } },
  });

  const layer = selectNewSkills({
    candidates: edges.map((edge) => edge.prerequisite),
    capacity,
    seenIds,
  });

  if (layer.length === 0) {
    return [];
  }

  const deeperLayers = await walkPrerequisites({
    depth: depth + 1,
    frontierIds: layer.map((skill) => skill.id),
    seenIds: new Set([...seenIds, ...layer.map((skill) => skill.id)]),
  });

  return [layer, ...deeperLayers];
}

const cachedGetSkillGraph = cacheAdminData(async (skillId: string) => {
  const [prerequisiteLayers, dependentEdges] = await Promise.all([
    walkPrerequisites({ depth: 1, frontierIds: [skillId], seenIds: new Set([skillId]) }),
    prisma.skillPrerequisite.findMany({
      orderBy: { skill: { name: "asc" } },
      select: { skill: { select: graphSkillSelect } },
      take: MAX_GRAPH_SKILLS,
      where: { prerequisiteId: skillId },
    }),
  ]);

  return { dependents: dependentEdges.map((edge) => edge.skill), prerequisiteLayers };
});

/**
 * The skill's place in the graph: prerequisites walked back a few layers and
 * the skills that list it as a direct prerequisite.
 */
export async function getSkillGraph(skillId: string) {
  return cachedGetSkillGraph(skillId);
}
