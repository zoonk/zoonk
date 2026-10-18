import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { type LibraryVisibility, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

/**
 * Each skill's items, learners, lessons and prerequisites, counted for the page's skills only: a
 * relation `_count` would count every skill's rows.
 */
async function countSkillRows(skillIds: string[]) {
  const [items, learnerSkills, lessons, prerequisites] = await Promise.all([
    prisma.item.groupBy({
      _count: { id: true },
      by: ["skillId"],
      where: { skillId: { in: skillIds } },
    }),
    prisma.learnerSkill.groupBy({
      _count: { id: true },
      by: ["skillId"],
      where: { skillId: { in: skillIds }, ...trackedAnalyticsUserRelationWhere },
    }),
    prisma.lessonSkill.groupBy({
      _count: { lessonId: true },
      by: ["skillId"],
      where: { skillId: { in: skillIds } },
    }),
    prisma.skillPrerequisite.groupBy({
      _count: { prerequisiteId: true },
      by: ["skillId"],
      where: { skillId: { in: skillIds } },
    }),
  ]);

  const itemsBySkill = new Map(items.map((row) => [row.skillId, row._count.id]));
  const learnersBySkill = new Map(learnerSkills.map((row) => [row.skillId, row._count.id]));
  const lessonsBySkill = new Map(lessons.map((row) => [row.skillId, row._count.lessonId]));

  const prerequisitesBySkill = new Map(
    prerequisites.map((row) => [row.skillId, row._count.prerequisiteId]),
  );

  return (skillId: string) => ({
    items: itemsBySkill.get(skillId) ?? 0,
    learnerSkills: learnersBySkill.get(skillId) ?? 0,
    lessons: lessonsBySkill.get(skillId) ?? 0,
    prerequisites: prerequisitesBySkill.get(skillId) ?? 0,
  });
}

const cachedListSkills = cacheAdminData(
  async (
    limit: number,
    offset: number,
    includeMerged: boolean,
    language?: string,
    visibility?: LibraryVisibility,
    search?: string,
  ) => {
    const where = {
      language,
      visibility,
      ...(includeMerged ? {} : { mergedIntoId: null }),
      ...(search ? { normalizedName: { contains: normalizeString(search) } } : {}),
    };

    const [skills, total] = await Promise.all([
      prisma.skill.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.skill.count({ where }),
    ]);

    const counts = await countSkillRows(skills.map((skill) => skill.id));

    return { skills: skills.map((skill) => ({ ...skill, _count: counts(skill.id) })), total };
  },
);

export type ListedSkill = Awaited<ReturnType<typeof listSkills>>["skills"][number];

/**
 * Skills are the unit of mastery, so admins browse them by language and
 * visibility. Merged duplicates stay in the table (learners' mastery moved to
 * the survivor) but are hidden unless asked for.
 */
export async function listSkills({
  includeMerged,
  language,
  limit,
  offset,
  search,
  visibility,
}: {
  includeMerged: boolean;
  language?: string;
  limit: number;
  offset: number;
  search?: string;
  visibility?: LibraryVisibility;
}) {
  return cachedListSkills(limit, offset, includeMerged, language, visibility, search);
}
