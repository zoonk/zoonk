import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const cachedListCourseSuggestionPrompts = cacheAdminData(
  async (limit: number, offset: number, search?: string) => {
    const where = buildCourseSuggestionPromptWhere({ search });

    const [prompts, total] = await Promise.all([
      prisma.searchPrompt.findMany({
        include: {
          suggestions: {
            include: { courseSuggestion: { include: { course: true } } },
            orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        where,
      }),
      prisma.searchPrompt.count({ where }),
    ]);

    return { prompts, total };
  },
);

export const countCourseSuggestionPrompts = cacheAdminData(() => prisma.searchPrompt.count());

export type ListedCourseSuggestionPrompt = Awaited<
  ReturnType<typeof listCourseSuggestionPrompts>
>["prompts"][number];

/**
 * Admin pages use object parameters at the call site, while the cached query
 * keeps primitive positional arguments internally so React cache can reuse the
 * same database result during one render pass.
 */
export async function listCourseSuggestionPrompts({
  limit,
  offset,
  search,
}: {
  limit: number;
  offset: number;
  search?: string;
}) {
  return cachedListCourseSuggestionPrompts(limit, offset, search);
}

/**
 * Prompt submissions are useful even when an admin only remembers part of the
 * learner prompt or one suggested course title. Searching the visible text
 * keeps the read-only log predictable without introducing separate filters.
 */
function buildCourseSuggestionPromptWhere({ search }: { search?: string }) {
  if (search) {
    const searchFilter = { contains: search, mode: "insensitive" as const };

    return {
      OR: [
        { prompt: searchFilter },
        { suggestions: { some: { courseSuggestion: { title: searchFilter } } } },
      ],
    };
  }
}
