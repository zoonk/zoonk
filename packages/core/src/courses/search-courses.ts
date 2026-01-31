import "server-only";
import { type Course, type Organization, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/constants";
import { mergeSearchResults } from "@zoonk/utils/search";
import { normalizeString } from "@zoonk/utils/string";

export type CourseWithOrganization = Course & {
  organization: Organization;
};

export async function searchCourses(params: {
  query: string;
  language: string;
  limit?: number;
  offset?: number;
}): Promise<CourseWithOrganization[]> {
  const limit = clampQueryItems(params.limit ?? DEFAULT_SEARCH_LIMIT);
  const offset = params.offset ?? 0;
  const normalizedSearch = normalizeString(params.query);

  if (!normalizedSearch) {
    return [];
  }

  const baseWhere = {
    isPublished: true,
    language: params.language,
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
      take: limit + offset + 1,
      where: {
        ...baseWhere,
        normalizedTitle: { contains: normalizedSearch, mode: "insensitive" },
      },
    }),
  ]);

  const merged = mergeSearchResults(exactMatch, containsMatches);

  return merged.slice(offset, offset + limit);
}
