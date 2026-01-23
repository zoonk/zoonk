import "server-only";
import { type Course, type Organization, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/constants";
import { mergeSearchResults } from "@zoonk/utils/search";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";

export type CourseWithOrganization = Course & {
  organization: Organization;
};

const cachedSearchCourses = cache(
  async (query: string, language: string, limit: number): Promise<CourseWithOrganization[]> => {
    const normalizedSearch = normalizeString(query);

    if (!normalizedSearch) {
      return [];
    }

    const baseWhere = {
      isPublished: true,
      language,
      organization: { kind: "brand" } as const,
    };

    const [exactMatch, containsMatches] = await Promise.all([
      prisma.course.findFirst({
        include: { organization: true },
        where: {
          ...baseWhere,
          normalizedTitle: normalizedSearch,
        },
      }),
      prisma.course.findMany({
        include: { organization: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        where: {
          ...baseWhere,
          normalizedTitle: { contains: normalizedSearch, mode: "insensitive" },
        },
      }),
    ]);

    return mergeSearchResults(exactMatch, containsMatches);
  },
);

export function searchCourses(params: {
  query: string;
  language: string;
  limit?: number;
}): Promise<CourseWithOrganization[]> {
  const limit = clampQueryItems(params.limit ?? DEFAULT_SEARCH_LIMIT);
  return cachedSearchCourses(params.query, params.language, limit);
}
