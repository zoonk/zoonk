import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

const TARGETS_PER_SEARCH = 6;

export type SkillMergeTarget = { id: string; learners: number; name: string };

/**
 * Skills a duplicate can merge into, by name. Core decides whether a merge is allowed; this only
 * leaves out the ones it would refuse, so staff don't pick a skill that can't be the survivor.
 */
export const searchSkillMergeTargets = cacheAdminData(
  async (duplicateId: string, query: string): Promise<SkillMergeTarget[]> => {
    const duplicate = await prisma.skill.findUnique({
      select: { language: true, ownerId: true, targetLanguage: true, visibility: true },
      where: { id: duplicateId },
    });

    if (!duplicate) {
      return [];
    }

    const skills = await prisma.skill.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
      take: TARGETS_PER_SEARCH,
      where: {
        ...duplicate,
        id: { not: duplicateId },
        mergedIntoId: null,
        normalizedName: { contains: normalizeString(query) },
      },
    });

    const learners = await prisma.learnerSkill.groupBy({
      _count: { id: true },
      by: ["skillId"],
      where: {
        skillId: { in: skills.map((skill) => skill.id) },
        ...trackedAnalyticsUserRelationWhere,
      },
    });

    const learnersBySkill = new Map(learners.map((row) => [row.skillId, row._count.id]));

    return skills.map((skill) => ({ ...skill, learners: learnersBySkill.get(skill.id) ?? 0 }));
  },
);
