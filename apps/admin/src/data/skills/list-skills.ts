import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { type LibraryVisibility, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

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
        include: {
          _count: {
            select: {
              items: true,
              learnerSkills: { where: trackedAnalyticsUserRelationWhere },
              lessons: true,
              prerequisites: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.skill.count({ where }),
    ]);

    return { skills, total };
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
