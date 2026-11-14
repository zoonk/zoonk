import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type Skill, prisma } from "@zoonk/db";

/** Upper bound on skills per side, so a hub skill can't render hundreds of rows. */
const MAX_GRAPH_SKILLS = 60;

const graphSkillSelect = { id: true, level: true, mergedIntoId: true, name: true } as const;

export type GraphSkill = Pick<Skill, "id" | "level" | "mergedIntoId" | "name">;

const cachedGetSkillGraph = cacheAdminData(async (skillId: string) => {
  const [prerequisiteEdges, dependentEdges] = await Promise.all([
    prisma.skillPrerequisite.findMany({
      orderBy: { prerequisite: { name: "asc" } },
      select: { prerequisite: { select: graphSkillSelect } },
      take: MAX_GRAPH_SKILLS,
      where: { skillId },
    }),
    prisma.skillPrerequisite.findMany({
      orderBy: { skill: { name: "asc" } },
      select: { skill: { select: graphSkillSelect } },
      take: MAX_GRAPH_SKILLS,
      where: { prerequisiteId: skillId },
    }),
  ]);

  return {
    dependents: dependentEdges.map((edge) => edge.skill),
    prerequisites: prerequisiteEdges.map((edge) => edge.prerequisite),
  };
});

/** The skills learned right before this one and right after it. */
export async function getSkillGraph(skillId: string) {
  return cachedGetSkillGraph(skillId);
}
